/**
 * TECHLAB WORKSHOPS — JavaScript didáctico
 *
 * Este archivo enseña:
 *  1. Selección de un elemento y sincronización de componentes.
 *  2. Validación comprensible de formularios.
 *  3. Gestión de estados: formulario → confirmación → formulario.
 *  4. Accesibilidad con foco, aria-live y navegación por teclado.
 *
 * No hay backend, envíos de red, cuentas ni almacenamiento personal.
 */
"use strict";

const workshops = {
  html: {
    title: "HTML5 desde cero",
    date: "4 diciembre 2026 · 18:00 h",
    icon: "5"
  },
  ux: {
    title: "Diseño UX aplicado",
    date: "11 diciembre 2026 · 18:00 h",
    icon: "✧"
  },
  ai: {
    title: "IA aplicada",
    date: "18 diciembre 2026 · 18:00 h",
    icon: "✦"
  }
};

const form = document.getElementById("bookingForm");
const nameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const select = document.getElementById("workshopSelect");
const cards = [...document.querySelectorAll(".workshop-card")];
const chooseButtons = [...document.querySelectorAll("[data-pick]")];
const confirmation = document.getElementById("confirmation");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
let selectedWorkshop = select.value;

/**
 * Actualiza el modelo visual sin duplicar tarjetas ni el formulario.
 * Los botones aria-pressed comunican también la selección al lector de pantalla.
 */
function chooseWorkshop(id, scrollToForm = false) {
  const item = workshops[id];
  if (!item) return;

  selectedWorkshop = id;
  select.value = id;

  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.workshop === id);
  });

  chooseButtons.forEach((button) => {
    const selected = button.dataset.pick === id;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", (selected ? "Taller seleccionado: " : "Elegir taller: ") + workshops[button.dataset.pick].title);
    button.innerHTML = selected ? 'Seleccionado <span aria-hidden="true">✓</span>' : "Elegir taller";
  });

  document.getElementById("summaryTitle").textContent = item.title;
  document.getElementById("summaryDate").textContent = item.date;

  const icon = document.getElementById("summaryIcon");
  icon.className = "summary-icon" + (id === "html" ? " html" : id === "ux" ? " ux" : "");
  icon.textContent = item.icon;
  document.getElementById("selectionLive").textContent = item.title + " seleccionado.";

  // En móvil, acercamos el formulario al usuario una vez elegido un taller.
  if (scrollToForm && window.matchMedia("(max-width: 760px)").matches) {
    document.getElementById("reserva").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  }
}

chooseButtons.forEach((button) => {
  button.addEventListener("click", () => chooseWorkshop(button.dataset.pick, true));
});
select.addEventListener("change", () => chooseWorkshop(select.value));

/**
 * SetError mantiene el mensaje próximo al campo incorrecto.
 * aria-invalid permite que una tecnología de asistencia anuncie su estado.
 */
function setError(input, message, messageId) {
  input.setAttribute("aria-invalid", message ? "true" : "false");
  document.getElementById(messageId).textContent = message;
  return !message;
}

function validateName() {
  const value = nameInput.value.trim();
  if (!value) return setError(nameInput, "Introduce tu nombre para continuar.", "nameError");
  if (value.length < 2) return setError(nameInput, "El nombre debe tener al menos dos caracteres.", "nameError");
  return setError(nameInput, "", "nameError");
}

function validateEmail() {
  const value = emailInput.value.trim();
  if (!value) return setError(emailInput, "Introduce tu correo electrónico.", "emailError");
  // Expresión sencilla para el ejercicio; no sustituye una validación de servidor.
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!valid) return setError(emailInput, "Revisa el correo. Ejemplo: nombre@dominio.es", "emailError");
  return setError(emailInput, "", "emailError");
}

nameInput.addEventListener("blur", validateName);
emailInput.addEventListener("blur", validateEmail);
nameInput.addEventListener("input", () => {
  if (nameInput.getAttribute("aria-invalid") === "true") validateName();
});
emailInput.addEventListener("input", () => {
  if (emailInput.getAttribute("aria-invalid") === "true") validateEmail();
});

/**
 * Proceso de reserva ficticia.
 * Siempre mostramos errores antes de cambiar al estado de confirmación.
 */
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const nameIsValid = validateName();
  const emailIsValid = validateEmail();
  if (!nameIsValid || !emailIsValid) {
    (nameIsValid ? emailInput : nameInput).focus();
    return;
  }

  const item = workshops[selectedWorkshop];
  document.getElementById("confirmedWorkshop").textContent = item.title;
  document.getElementById("confirmedDate").textContent = item.date;
  // textContent evita interpretar como HTML la entrada de una persona.
  document.getElementById("confirmedName").textContent = nameInput.value.trim();
  document.getElementById("referenceCode").textContent =
    "REFERENCIA DEMO TL-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  form.hidden = true;
  confirmation.hidden = false;
  document.getElementById("confirmationTitle").focus();
});

document.getElementById("newBooking").addEventListener("click", () => {
  form.reset();
  nameInput.removeAttribute("aria-invalid");
  emailInput.removeAttribute("aria-invalid");
  document.getElementById("nameError").textContent = "";
  document.getElementById("emailError").textContent = "";
  confirmation.hidden = true;
  form.hidden = false;
  chooseWorkshop("ai");
  nameInput.focus();
});

/**
 * Menú accesible de móvil:
 * - aria-expanded describe su estado.
 * - Escape lo cierra devolviendo el foco al botón.
 * - Los enlaces cierran el menú al navegar.
 */
function toggleMenu(forceOpen) {
  const open = typeof forceOpen === "boolean" ? forceOpen : !mainNav.classList.contains("open");
  mainNav.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
}

menuToggle.addEventListener("click", () => toggleMenu());
mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => toggleMenu(false));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mainNav.classList.contains("open")) {
    toggleMenu(false);
    menuToggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!mainNav.contains(event.target) && !menuToggle.contains(event.target)) toggleMenu(false);
});

// Estado inicial: el taller IA aplicada comienza seleccionado en el HTML.
chooseWorkshop(selectedWorkshop);
