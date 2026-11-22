/* TV LAB · Unidad 9 HCI
   JavaScript didáctico: eventos, validación, estado, API asíncrona y feedback.
   Importante: YouTube se integra mediante un iframe, NO mediante <video>.
   La API se descarga únicamente cuando el usuario pulsa «Cargar vídeo». */
"use strict";

const $ = (selector) => document.querySelector(selector);

const ui = {
  form: $("#videoForm"), url: $("#videoUrl"), error: $("#videoError"),
  load: $("#loadButton"), placeholder: $("#screenPlaceholder"), busy: $("#screenBusy"),
  statusBadge: $("#statusBadge"), statusText: $("#statusText"),
  apiState: $("#apiState"), playerState: $("#playerState"), videoId: $("#currentVideoId"),
  log: $("#eventLog"), tv: $("#tvScene"),
  play: $("#playButton"), pause: $("#pauseButton"), stop: $("#stopButton"),
  back: $("#backButton"), forward: $("#forwardButton"),
  mute: $("#muteButton"), muteText: $("#muteText"), muteIcon: $("#muteIcon"),
  volume: $("#volumeSlider"), volumeOutput: $("#volumeOutput"),
  progress: $("#progressSlider"), time: $("#timeOutput"),
  theme: $("#themeButton"), themeIcon: $("#themeIcon"), themeLabel: $("#themeLabel"),
  count: $("#challengeCount"), taskProgress: $("#challengeProgress")
};

const STORAGE_PREFIX = "tvlab-hci-v1:";
const DEFAULT_VIDEO = "M7lc1UVf-VE"; // Identificador usado en la documentación oficial de la IFrame API.
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_STATES = {
  [-1]: { label: "Sin iniciar", tone: "ready" },
  [0]: { label: "Finalizado", tone: "paused" },
  [1]: { label: "Reproduciendo", tone: "playing" },
  [2]: { label: "En pausa", tone: "paused" },
  [3]: { label: "Cargando vídeo", tone: "loading" },
  [5]: { label: "Preparado", tone: "ready" }
};

let player = null;
let playerReady = false;
let apiRequested = false;
let apiTimeout = null;
let playbackClock = null;
let pendingVideoId = DEFAULT_VIDEO;
let activeVideoId = null;
let seeking = false;

function savePreference(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); }
  catch { /* Preferencias opcionales: la aplicación sigue funcionando. */ }
}

function readPreference(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function logEvent(message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString("es-ES", { hour12: false });
  item.append(time, document.createTextNode(" " + message));
  ui.log.prepend(item);
  while (ui.log.children.length > 5) ui.log.lastElementChild.remove();
  console.info("[TV LAB]", message);
}

function setStatus(label, tone = "ready", detail = label) {
  ui.statusText.textContent = label;
  ui.statusBadge.dataset.state = tone;
  ui.playerState.textContent = detail;
}

function showError(message) {
  ui.url.setAttribute("aria-invalid", "true");
  ui.error.textContent = message;
  ui.error.hidden = false;
}

function clearError() {
  ui.url.removeAttribute("aria-invalid");
  ui.error.textContent = "";
  ui.error.hidden = true;
}

/**
 * Función pura: no modifica la página ni se conecta a Internet.
 * Permite practicar URL, condicionales, expresiones regulares y validación.
 */
function extractVideoId(input) {
  const raw = String(input ?? "").trim();
  if (VIDEO_ID_REGEX.test(raw)) return raw;

  let parsed;
  try { parsed = new URL(raw); }
  catch { return null; }

  if (!["https:", "http:"].includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  const youtubeHosts = new Set([
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "youtube-nocookie.com", "www.youtube-nocookie.com"
  ]);
  let candidate = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0];
  } else if (youtubeHosts.has(host)) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") candidate = parsed.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) candidate = parts[1];
  }
  return VIDEO_ID_REGEX.test(candidate ?? "") ? candidate : null;
}

function setControlsEnabled(enabled) {
  for (const button of [ui.play, ui.pause, ui.stop, ui.back, ui.forward, ui.mute]) {
    button.disabled = !enabled;
  }
  ui.volume.disabled = !enabled;
  ui.progress.disabled = !enabled;
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${String(minutes).padStart(2, "0")}:${secs}`;
}

function updatePlaybackUI() {
  if (!playerReady || !player) return;
  try {
    const duration = player.getDuration();
    const current = player.getCurrentTime();
    const hasDuration = Number.isFinite(duration) && duration > 0;
    if (!seeking) {
      ui.progress.value = hasDuration ? String(Math.round((current / duration) * 1000)) : "0";
    }
    ui.progress.disabled = !hasDuration;
    ui.time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    const muted = player.isMuted();
    ui.muteText.textContent = muted ? "Activar sonido" : "Silenciar";
    ui.muteIcon.textContent = muted ? "◖×" : "◖))";
    ui.mute.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar vídeo");
  } catch (error) {
    // Puede ocurrir durante un cambio de vídeo: el siguiente ciclo se recuperará.
    console.debug("[TV LAB] Reproductor temporalmente no disponible:", error);
  }
}

function apiFailure(message) {
  clearTimeout(apiTimeout);
  apiTimeout = null;
  apiRequested = false;
  playerReady = false;
  ui.busy.hidden = true;
  ui.placeholder.hidden = false;
  ui.load.disabled = false;
  ui.apiState.textContent = "No disponible";
  setControlsEnabled(false);
  setStatus("Error de conexión", "error", "No conectado");
  showError(message);
  logEvent("Error: no se pudo conectar con la API");
}

function onPlayerReady(event) {
  clearTimeout(apiTimeout);
  apiTimeout = null;
  playerReady = true;
  ui.busy.hidden = true;
  ui.placeholder.hidden = true;
  ui.load.disabled = false;
  ui.apiState.textContent = "Conectada";
  ui.videoId.textContent = activeVideoId ?? "Ninguno";
  setControlsEnabled(true);
  setStatus("Preparado", "ready", "Vídeo cargado");
  event.target.setVolume(Number(ui.volume.value));
  logEvent("onReady: reproductor preparado");
  updatePlaybackUI();
  if (playbackClock === null) playbackClock = window.setInterval(updatePlaybackUI, 650);
}

function onPlayerStateChange(event) {
  const state = PLAYER_STATES[event.data] || { label: "Estado desconocido", tone: "ready" };
  setStatus(state.label, state.tone);
  logEvent(`onStateChange(${event.data}): ${state.label}`);
  updatePlaybackUI();
}

function onPlayerError(event) {
  const messages = {
    2: "El identificador del vídeo no es válido.",
    5: "El vídeo no puede reproducirse con el reproductor HTML5.",
    100: "El vídeo no está disponible o es privado.",
    101: "El propietario no permite insertar este vídeo en otras páginas.",
    150: "El propietario no permite insertar este vídeo en otras páginas.",
    153: "YouTube requiere información de origen de la página. Prueba con un servidor local o GitHub Pages."
  };
  const message = messages[event.data] || "YouTube no ha podido reproducir este vídeo. Prueba con otro enlace.";
  setStatus("Vídeo no disponible", "error", "Error de reproducción");
  showError(message);
  logEvent(`onError(${event.data}): ${message}`);
}

function createPlayer() {
  if (!window.YT || typeof window.YT.Player !== "function") return;
  clearTimeout(apiTimeout);
  apiTimeout = null;
  ui.apiState.textContent = "API descargada";
  logEvent("onYouTubeIframeAPIReady: API disponible");
  try {
    player = new window.YT.Player("youtubePlayer", {
      width: "640", height: "360", videoId: pendingVideoId,
      playerVars: { playsinline: 1, controls: 1, rel: 0, enablejsapi: 1 },
      events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
    });
  } catch {
    apiFailure("No ha sido posible crear el reproductor. Comprueba la conexión y vuelve a cargar la página.");
  }
}

// YouTube invoca esta función global después de descargar su biblioteca externa.
window.onYouTubeIframeAPIReady = createPlayer;

function requestYouTubeApi() {
  if (apiRequested) return;
  apiRequested = true;
  ui.apiState.textContent = "Conectando…";
  logEvent("Solicitando la IFrame Player API");
  if (window.YT?.Player) {
    createPlayer();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.async = true;
  script.onerror = () => apiFailure("No se ha podido descargar la API de YouTube. Comprueba la conexión y vuelve a intentarlo.");
  document.head.appendChild(script);
  apiTimeout = window.setTimeout(() => {
    if (!playerReady) apiFailure("La conexión con YouTube está tardando demasiado. Comprueba la red y vuelve a intentarlo.");
  }, 15000);
}

function loadVideo(event) {
  event.preventDefault();
  clearError();
  const id = extractVideoId(ui.url.value);
  if (!id) {
    showError("Introduce un enlace válido de YouTube o un ID de 11 caracteres.");
    ui.url.focus();
    logEvent("Formulario: URL rechazada por validación");
    return;
  }

  activeVideoId = pendingVideoId = id;
  ui.videoId.textContent = id;
  savePreference("videoId", id);
  logEvent("Formulario: ID validado → " + id);
  if (playerReady && player) {
    try {
      player.cueVideoById({ videoId: id });
      setStatus("Preparando vídeo", "loading");
      ui.progress.value = "0";
      ui.time.textContent = "00:00 / 00:00";
      logEvent("cueVideoById: vídeo seleccionado sin autoplay");
    } catch {
      showError("No se pudo cambiar el vídeo. Prueba a recargar la página.");
    }
    return;
  }

  ui.load.disabled = true;
  ui.placeholder.hidden = true;
  ui.busy.hidden = false;
  setStatus("Conectando", "loading");
  requestYouTubeApi();
}

function withPlayer(action, label) {
  if (!playerReady || !player) return;
  try { action(player); logEvent(label); updatePlaybackUI(); }
  catch { showError("El reproductor todavía no está preparado para esa acción."); }
}

function togglePlayback() {
  if (!playerReady || !player) return;
  const isPlaying = player.getPlayerState() === window.YT.PlayerState.PLAYING;
  if (isPlaying) withPlayer(p => p.pauseVideo(), "Acción del usuario: pausa");
  else withPlayer(p => p.playVideo(), "Acción del usuario: reproducción");
}

function move(seconds) {
  withPlayer(p => {
    const current = p.getCurrentTime();
    const duration = p.getDuration();
    const next = Math.max(0, Math.min(duration || current + seconds, current + seconds));
    p.seekTo(next, true);
  }, `Acción del usuario: salto ${seconds > 0 ? "+" : ""}${seconds} s`);
}

function toggleMute() {
  withPlayer(p => p.isMuted() ? p.unMute() : p.mute(), "Acción del usuario: alternar sonido");
}

function changeFrame(value) {
  if (!["classic", "retro", "minimal"].includes(value)) return;
  ui.tv.dataset.frame = value;
  savePreference("frame", value);
  logEvent(`CSS: marco de TV cambiado a ${value}`);
}

function applyTheme(theme, save = true) {
  const dark = theme === "dark";
  document.body.dataset.theme = dark ? "dark" : "light";
  ui.theme.setAttribute("aria-pressed", String(dark));
  ui.theme.setAttribute("aria-label", dark ? "Activar tema claro" : "Activar tema oscuro");
  ui.themeIcon.textContent = dark ? "☼" : "☾";
  ui.themeLabel.textContent = dark ? "Modo claro" : "Modo oscuro";
  if (save) savePreference("theme", dark ? "dark" : "light");
}

function updateChallenges() {
  const items = [...document.querySelectorAll("[data-task]")];
  const done = items.filter(item => item.checked);
  ui.count.textContent = `${done.length} de ${items.length} retos revisados`;
  ui.taskProgress.value = done.length;
  ui.taskProgress.setAttribute("aria-valuetext", `${done.length} de ${items.length} retos revisados`);
  ui.taskProgress.textContent = `${done.length} de ${items.length}`;
  savePreference("tasks", done.map(item => item.dataset.task));
}

function init() {
  const previousVideo = readPreference("videoId", DEFAULT_VIDEO);
  if (typeof previousVideo === "string" && VIDEO_ID_REGEX.test(previousVideo)) {
    ui.url.value = `https://www.youtube.com/watch?v=${previousVideo}`;
  }

  applyTheme(readPreference("theme", "light"), false);
  const savedFrame = readPreference("frame", "classic");
  const radio = document.querySelector(`input[name="tvFrame"][value="${["classic", "retro", "minimal"].includes(savedFrame) ? savedFrame : "classic"}"]`);
  if (radio) { radio.checked = true; ui.tv.dataset.frame = radio.value; }

  ui.form.addEventListener("submit", loadVideo);
  ui.url.addEventListener("input", clearError);
  ui.play.addEventListener("click", () => withPlayer(p => p.playVideo(), "Acción del usuario: Play"));
  ui.pause.addEventListener("click", () => withPlayer(p => p.pauseVideo(), "Acción del usuario: Pausa"));
  ui.stop.addEventListener("click", () => withPlayer(p => p.stopVideo(), "Acción del usuario: Stop"));
  ui.back.addEventListener("click", () => move(-10));
  ui.forward.addEventListener("click", () => move(10));
  ui.mute.addEventListener("click", toggleMute);

  ui.volume.addEventListener("input", () => {
    ui.volumeOutput.textContent = `${ui.volume.value} %`;
    withPlayer(p => p.setVolume(Number(ui.volume.value)), `Acción del usuario: volumen ${ui.volume.value} %`);
  });

  ui.progress.addEventListener("pointerdown", () => { seeking = true; });
  ui.progress.addEventListener("pointerup", () => { seeking = false; });
  ui.progress.addEventListener("change", () => {
    if (playerReady && player) {
      const duration = player.getDuration();
      if (duration > 0) withPlayer(p => p.seekTo((Number(ui.progress.value) / 1000) * duration, true), "Acción del usuario: buscar posición");
    }
    seeking = false;
  });

  for (const item of document.querySelectorAll('input[name="tvFrame"]')) {
    item.addEventListener("change", () => { if (item.checked) changeFrame(item.value); });
  }
  ui.theme.addEventListener("click", () => {
    applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    logEvent("CSS: alternar tema visual");
  });

  const taskNames = new Set(readPreference("tasks", []));
  for (const checkbox of document.querySelectorAll("[data-task]")) {
    checkbox.checked = taskNames.has(checkbox.dataset.task);
    checkbox.addEventListener("change", updateChallenges);
  }
  updateChallenges();

  document.addEventListener("keydown", event => {
    const target = event.target;
    if (target instanceof Element && target.closest("input,button,textarea,select,[contenteditable=true]")) return;
    if (!playerReady || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
    else if (event.key.toLowerCase() === "m") { event.preventDefault(); toggleMute(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); move(-10); }
    else if (event.key === "ArrowRight") { event.preventDefault(); move(10); }
  });
}

init();
