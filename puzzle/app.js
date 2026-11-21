/*
 * Puzzle UX Lab · Unidad 9 de HCI
 * HTML5 + CSS3 + JavaScript, sin frameworks y sin servidor.
 *
 * Conceptos que puedes localizar en este archivo:
 *   1. DOM y eventos: click, change, dragstart, dragover, drop, keydown.
 *   2. Estado: orden de las piezas, selección, movimientos y victoria.
 *   3. Temporizador: Date.now() + setInterval() para un tiempo real fiable.
 *   4. File API + Canvas: carga local y recorte de imágenes sin subirlas.
 *   5. HCI: mensajes de estado, teclado, feedback y prevención de errores.
 */

(() => {
  "use strict";

  // Imagen ilustrativa integrada: la demo funciona incluso sin archivos extra.
  const demoSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#101d53"/><stop offset=".45" stop-color="#7445a3"/><stop offset="1" stop-color="#e8819e"/></linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff5ba"/><stop offset=".6" stop-color="#ffcc88"/><stop offset="1" stop-color="#fb8e99"/></linearGradient>
        <linearGradient id="mountain" x2="0" y2="1"><stop stop-color="#5b5eab"/><stop offset="1" stop-color="#24255b"/></linearGradient>
        <linearGradient id="water" x2="0" y2="1"><stop stop-color="#9672c5"/><stop offset=".7" stop-color="#2b6a87"/><stop offset="1" stop-color="#123d61"/></linearGradient>
        <linearGradient id="fore" x2="1" y2="1"><stop stop-color="#304c72"/><stop offset="1" stop-color="#111e42"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="28"/></filter>
      </defs>
      <rect width="1200" height="1200" fill="url(#sky)"/>
      <g fill="#fff"><circle cx="130" cy="138" r="5"/><circle cx="239" cy="262" r="3"/><circle cx="460" cy="114" r="4"/><circle cx="615" cy="180" r="2.8"/><circle cx="1011" cy="95" r="5"/><circle cx="1090" cy="340" r="3"/><circle cx="115" cy="418" r="2.4"/><circle cx="722" cy="88" r="3.6"/><circle cx="547" cy="347" r="2"/><circle cx="358" cy="369" r="3"/></g>
      <g opacity=".35" stroke="#fff" stroke-width="3"><path d="M129 110v55M102 138h55"/><path d="M1008 68v55M980 95h55"/><path d="M458 95v38M439 114h38"/></g>
      <circle cx="825" cy="339" r="224" fill="#ffc4a1" opacity=".3" filter="url(#glow)"/>
      <circle cx="825" cy="339" r="189" fill="url(#sun)"/>
      <g stroke="#d96494" stroke-width="11" opacity=".48"><path d="M659 355h332"/><path d="M648 394h354"/><path d="M661 430h327"/><path d="M690 469h270"/></g>
      <path d="M0 648 154 400 310 622 430 458 590 648 773 475 965 654 1070 513 1200 667V1200H0Z" fill="#b6a0d0"/>
      <path d="M0 707 189 518 360 732 526 537 692 731 853 570 1037 746 1200 598V1200H0Z" fill="url(#mountain)"/>
      <path d="M0 790 190 722 332 785 513 708 686 778 830 713 1010 785 1200 710V1200H0Z" fill="#263363"/>
      <path d="M0 812Q270 760 483 815T1200 802V1200H0Z" fill="url(#water)"/>
      <g fill="none" stroke="#fac3ba" opacity=".45" stroke-width="8"><path d="M66 854Q282 820 515 858T1110 846"/><path d="M201 909Q444 878 663 916T1100 895"/><path d="M36 1013Q338 969 624 1010T1170 995"/></g>
      <path d="M0 993 189 893 339 1045 520 934 748 1087 958 919 1200 1030V1200H0Z" fill="url(#fore)"/>
      <path d="M0 1126 168 1069 317 1165 470 1101 639 1200H0Z" fill="#101b3c"/><path d="M810 1200 985 1080 1092 1142 1200 1061V1200Z" fill="#101b3c"/>
      <g fill="#152344"><path d="M102 1015l-23 64h15l-25 58h66l-25-58h15z"/><path d="M111 990l-20 58h40z"/><path d="M1107 962l-29 85h18l-35 84h93l-35-84h18z"/><path d="M1108 921l-30 75h60z"/></g>
      <path d="M500 1200 590 1080 615 1061 650 1096 747 1200" fill="#ca7ba6" opacity=".85"/>
      <path d="M0 0H1200V1200H0Z" fill="none" stroke="#ffffff13" stroke-width="16"/>
    </svg>`;
  const DEFAULT_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(demoSvg)}`;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);
  const ui = {
    board: $("puzzle"), timer: $("timer"), moves: $("moves"), correct: $("correctCount"),
    progress: $("progress"), sizeLabel: $("boardDifficulty"), status: $("statusMessage"),
    gameStatus: $("gameStatus"), gameStatusText: $("gameStatusText"),
    restart: $("restartBtn"), playAgain: $("playAgainBtn"), victory: $("victory"),
    victoryTitle: $("victoryTitle"), finalTime: $("finalTime"), finalMoves: $("finalMoves"),
    imageInput: $("uploadInput"), dropZone: $("dropZone"), imageInfo: $("imageInfo"),
    imageError: $("errorMessage"), thumbnail: $("originalImage"),
    numbers: $("showNumbers"), preview: $("previewBtn"),
    previewDialog: $("previewDialog"), largePreview: $("largePreview")
  };

  const game = {
    size: 3, imageUrl: DEFAULT_IMAGE, imageName: "Paisaje de ejemplo", order: [],
    selected: null, dragged: null, moves: 0, startedAt: null, elapsedMs: 0,
    timerId: null, finished: false, lastDropAt: -Infinity, imageLoadNumber: 0
  };

  const total = () => game.size * game.size;
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const isSolved = () => game.order.every((piece, position) => piece === position);

  function announce(message) {
    ui.status.textContent = message;
  }

  function changeGameStatus(label, kind = "ready") {
    ui.gameStatusText.textContent = label;
    ui.gameStatus.classList.toggle("is-playing", kind === "playing");
    ui.gameStatus.classList.toggle("is-won", kind === "won");
  }

  function updateTimer() {
    if (game.startedAt !== null) game.elapsedMs = Date.now() - game.startedAt;
    ui.timer.textContent = formatTime(game.elapsedMs);
  }

  function startTimer() {
    if (game.startedAt !== null || game.finished) return;
    game.startedAt = Date.now();
    game.timerId = window.setInterval(updateTimer, 250);
    changeGameStatus("Partida en curso", "playing");
  }

  function stopTimer() {
    if (game.startedAt !== null) game.elapsedMs = Date.now() - game.startedAt;
    if (game.timerId !== null) window.clearInterval(game.timerId);
    game.timerId = null;
    game.startedAt = null;
    updateTimer();
  }

  function shuffleOrder(size) {
    const arr = Array.from({ length: size * size }, (_, i) => i);
    // Fisher-Yates: todas las permutaciones tienen la misma probabilidad.
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Una nueva partida nunca debe empezar ya resuelta.
    if (arr.every((piece, i) => piece === i)) [arr[0], arr[1]] = [arr[1], arr[0]];
    return arr;
  }

  function renderBoard(focusPosition = null) {
    const fragment = document.createDocumentFragment();
    const gridSize = game.size;

    game.order.forEach((piece, position) => {
      const tile = document.createElement("button");
      const sourceRow = Math.floor(piece / gridSize);
      const sourceColumn = piece % gridSize;
      const correct = piece === position;
      const selected = game.selected === position;

      tile.type = "button";
      tile.className = `tile${selected ? " is-selected" : ""}`;
      tile.dataset.position = String(position);
      tile.dataset.number = String(piece + 1);
      tile.style.backgroundImage = `url("${game.imageUrl}")`;
      tile.style.backgroundSize = `${gridSize * 100}% ${gridSize * 100}%`;
      tile.style.backgroundPosition = `${(sourceColumn / (gridSize - 1)) * 100}% ${(sourceRow / (gridSize - 1)) * 100}%`;
      tile.setAttribute("aria-pressed", String(selected));
      tile.setAttribute("aria-label", `Pieza ${piece + 1}, posición ${position + 1} de ${total()}, ${correct ? "bien colocada" : "fuera de su lugar"}${selected ? ", seleccionada" : ""}.`);
      tile.draggable = !game.finished;
      tile.disabled = game.finished;
      fragment.appendChild(tile);
    });

    ui.board.replaceChildren(fragment);
    ui.board.style.setProperty("--size", String(gridSize));
    ui.board.classList.toggle("hide-numbers", !ui.numbers.checked);
    if (focusPosition !== null && !game.finished) {
      ui.board.querySelector(`[data-position="${focusPosition}"]`)?.focus({ preventScroll: true });
    }
  }

  function updateStats() {
    const placed = game.order.filter((piece, position) => piece === position).length;
    ui.moves.textContent = String(game.moves);
    ui.correct.textContent = `${placed} / ${total()}`;
    ui.progress.max = total();
    ui.progress.value = placed;
    ui.sizeLabel.textContent = `${game.size} × ${game.size}`;
    updateTimer();
  }

  function newGame(message = "Nueva partida preparada. ¡Puedes empezar!") {
    stopTimer();
    game.order = shuffleOrder(game.size);
    game.selected = null;
    game.dragged = null;
    game.moves = 0;
    game.elapsedMs = 0;
    game.finished = false;
    game.lastDropAt = -Infinity;
    ui.victory.hidden = true;
    changeGameStatus("Listo para jugar");
    renderBoard();
    updateStats();
    announce(message);
  }

  function finishGame() {
    stopTimer();
    game.finished = true;
    game.selected = null;
    changeGameStatus("Completado", "won");
    ui.finalTime.textContent = formatTime(game.elapsedMs);
    ui.finalMoves.textContent = String(game.moves);
    ui.victory.hidden = false;
    renderBoard();
    updateStats();
    announce(`¡Puzzle completado! Tiempo: ${formatTime(game.elapsedMs)}. Movimientos: ${game.moves}.`);
    ui.victoryTitle.focus({ preventScroll: true });
  }

  function swapPositions(first, second) {
    if (game.finished || first === second || first === null || second === null) return;
    if (game.startedAt === null) startTimer();
    [game.order[first], game.order[second]] = [game.order[second], game.order[first]];
    game.moves += 1;
    game.selected = null;
    renderBoard(second);
    updateStats();

    if (isSolved()) finishGame();
    else announce(`Movimiento ${game.moves} realizado. Elige otras dos piezas.`);
  }

  function selectPosition(position) {
    if (game.finished) return;
    if (game.selected === null) {
      game.selected = position;
      renderBoard(position);
      announce(`Pieza ${game.order[position] + 1} seleccionada. Elige otra pieza para intercambiarlas.`);
      return;
    }
    if (game.selected === position) {
      game.selected = null;
      renderBoard(position);
      announce("Selección cancelada.");
      return;
    }
    swapPositions(game.selected, position);
  }

  function tileFromEvent(event) {
    return event.target instanceof Element ? event.target.closest(".tile") : null;
  }

  // Seleccionar con clic y toque también funciona donde el Drag & Drop nativo no funciona.
  ui.board.addEventListener("click", (event) => {
    if (performance.now() - game.lastDropAt < 400) return;
    const tile = tileFromEvent(event);
    if (tile) selectPosition(Number(tile.dataset.position));
  });

  ui.board.addEventListener("dragstart", (event) => {
    const tile = tileFromEvent(event);
    if (!tile || game.finished) return;
    game.dragged = Number(tile.dataset.position);
    tile.classList.add("is-dragged");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(game.dragged));
  });

  ui.board.addEventListener("dragover", (event) => {
    const tile = tileFromEvent(event);
    if (!tile || game.dragged === null || Number(tile.dataset.position) === game.dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    ui.board.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    tile.classList.add("is-drop-target");
  });

  ui.board.addEventListener("dragleave", (event) => {
    tileFromEvent(event)?.classList.remove("is-drop-target");
  });

  ui.board.addEventListener("drop", (event) => {
    const tile = tileFromEvent(event);
    if (!tile || game.dragged === null) return;
    event.preventDefault();
    const from = game.dragged;
    const to = Number(tile.dataset.position);
    game.lastDropAt = performance.now();
    game.dragged = null;
    swapPositions(from, to);
    ui.board.querySelectorAll(".is-drop-target, .is-dragged").forEach((node) => node.classList.remove("is-drop-target", "is-dragged"));
  });

  ui.board.addEventListener("dragend", () => {
    game.dragged = null;
    ui.board.querySelectorAll(".is-drop-target, .is-dragged").forEach((node) => node.classList.remove("is-drop-target", "is-dragged"));
  });

  // Tab llega a las fichas; las flechas permiten recorrer el tablero más rápido.
  ui.board.addEventListener("keydown", (event) => {
    const tile = tileFromEvent(event);
    if (!tile) return;
    const current = Number(tile.dataset.position);
    const row = Math.floor(current / game.size);
    const column = current % game.size;
    let next = current;
    if (event.key === "ArrowRight" && column < game.size - 1) next += 1;
    else if (event.key === "ArrowLeft" && column > 0) next -= 1;
    else if (event.key === "ArrowDown" && row < game.size - 1) next += game.size;
    else if (event.key === "ArrowUp" && row > 0) next -= game.size;
    else if (event.key === "Escape" && game.selected !== null) {
      event.preventDefault();
      game.selected = null;
      renderBoard(current);
      announce("Selección cancelada.");
      return;
    }
    if (next !== current) {
      event.preventDefault();
      ui.board.querySelector(`[data-position="${next}"]`)?.focus();
    }
    // Enter y Espacio activan el botón de forma nativa y generan click.
  });

  ui.restart.addEventListener("click", () => newGame("Nueva mezcla creada. El reloj volverá a empezar en tu primer movimiento."));
  ui.playAgain.addEventListener("click", () => { newGame("¡Nueva partida lista!"); ui.board.querySelector(".tile")?.focus(); });

  document.querySelectorAll('input[name="difficulty"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      game.size = Number(radio.value);
      newGame(`Dificultad cambiada a ${game.size} por ${game.size}. Nueva partida preparada.`);
    });
  });

  ui.numbers.addEventListener("change", () => {
    ui.board.classList.toggle("hide-numbers", !ui.numbers.checked);
    announce(ui.numbers.checked ? "Los números de ayuda están visibles." : "Los números de ayuda están ocultos.");
  });

  ui.preview.addEventListener("click", () => ui.previewDialog.showModal());

  function showImageError(text) {
    ui.imageError.hidden = false;
    ui.imageError.textContent = text;
    announce(text);
  }

  function hideImageError() {
    ui.imageError.hidden = true;
    ui.imageError.textContent = "";
  }

  // Redimensiona y recorta la imagen al cuadrado para que todas las piezas encajen.
  // El archivo original no sale del navegador: Canvas produce una imagen local.
  function useImageFile(file) {
    if (!file) return;
    hideImageError();
    if (!file.type.startsWith("image/")) {
      showImageError("Selecciona un archivo de imagen válido (JPG, PNG o WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showImageError("La imagen supera los 10 MB. Selecciona una más pequeña.");
      return;
    }

    const thisLoad = ++game.imageLoadNumber;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (thisLoad !== game.imageLoadNumber) return;
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx || !image.naturalWidth || !image.naturalHeight) throw new Error("Imagen no válida");
        canvas.width = canvas.height = 900;
        ctx.fillStyle = "#172240";
        ctx.fillRect(0, 0, 900, 900);
        const crop = Math.min(image.naturalWidth, image.naturalHeight);
        const cropX = (image.naturalWidth - crop) / 2;
        const cropY = (image.naturalHeight - crop) / 2;
        ctx.drawImage(image, cropX, cropY, crop, crop, 0, 0, 900, 900);
        game.imageUrl = canvas.toDataURL("image/jpeg", .92);
        game.imageName = file.name;
        ui.thumbnail.src = game.imageUrl;
        ui.largePreview.src = game.imageUrl;
        ui.imageInfo.textContent = `Imagen cargada: ${file.name}. Se ha recortado al centro para formar un cuadrado.`;
        newGame("Imagen cargada correctamente. La partida empieza con una nueva mezcla.");
      } catch (_error) {
        showImageError("No se ha podido procesar esta imagen. Prueba con otra foto.");
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (thisLoad === game.imageLoadNumber) showImageError("El navegador no ha podido abrir este archivo como imagen.");
    };
    image.src = objectUrl;
  }

  ui.imageInput.addEventListener("change", (event) => {
    useImageFile(event.target.files?.[0]);
    event.target.value = ""; // Permite volver a elegir la misma imagen.
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropZone.classList.add("dragover");
    });
  });
  ui.dropZone.addEventListener("dragleave", (event) => {
    if (!ui.dropZone.contains(event.relatedTarget)) ui.dropZone.classList.remove("dragover");
  });
  ui.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    ui.dropZone.classList.remove("dragover");
    useImageFile(event.dataTransfer.files?.[0]);
  });
  ui.imageInput.addEventListener("focus", () => ui.dropZone.classList.add("keyboard-focus"));
  ui.imageInput.addEventListener("blur", () => ui.dropZone.classList.remove("keyboard-focus"));

  // Evita que una imagen soltada fuera de la zona sustituya la página en el navegador.
  document.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length && !ui.dropZone.contains(event.target)) event.preventDefault();
  });

  ui.thumbnail.src = DEFAULT_IMAGE;
  ui.largePreview.src = DEFAULT_IMAGE;
  newGame("Puzzle listo. Selecciona dos piezas para comenzar.");
})();
