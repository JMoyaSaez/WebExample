# TechLab Workshops — actividad de HCI

Web responsive de **reserva simulada de talleres** creada con **HTML5, CSS3 y JavaScript nativo**. Es un ejemplo completo y editable para la Unidad 8, Clase 3.

> Los talleres y las reservas son ficticios. **No hay backend ni envío de datos personales.** Usa nombres y correos de prueba.

## 1. Abrir la web

1. Descomprime el ZIP.
2. Abre el archivo index.html con cualquier navegador moderno. No necesitas instalar paquetes ni ejecutar comandos.
3. Si utilizas VS Code, también puedes abrir la carpeta y ejecutar *Live Server*.

## 2. Qué aprenderás

| Concepto HCI | Cómo se trabaja en el ejemplo |
| --- | --- |
| Diseño responsive | Tres tarjetas en escritorio que cambian de disposición en móvil. |
| Responsive y unidades relativas | Grids flexibles con fr, rem, minmax y media queries. |
| HTML5 semántico | header, nav, main, section, article, aside, form y footer. |
| Accesibilidad | Etiquetas explícitas, enlace para saltar contenido, foco visible y ARIA. |
| Feedback | Selección de talleres, errores de campos y estado de confirmación. |
| Prevención de errores | Validación del nombre y correo antes de confirmar. |
| Progressive Enhancement | Contenido y FAQ legibles con HTML/CSS; JS añade la simulación. |

## 3. Actividad propuesta — 30 minutos

**Reto:** personaliza la web para otro contexto real, por ejemplo *reserva de pistas deportivas*, *biblioteca*, *cita de reparación* o *inscripción a un evento*. Conserva el flujo completo, pero cambia la información, el diseño y al menos una decisión de interacción.

1. **5 min — Análisis HCI.** Identifica usuario, tarea principal y los tres estados de la interfaz.
2. **10 min — HTML/CSS.** Personaliza contenido, colores, tarjetas y disposición en escritorio/móvil.
3. **10 min — JavaScript.** Cambia las opciones en el objeto workshops y actualiza la validación o la confirmación.
4. **5 min — QA y entrega.** Prueba con teclado y un ancho de 390 px. Sube el proyecto a GitHub con dos capturas.

## 4. Casos de prueba que debe superar

### Escenario A — Móvil
- Redimensiona a 390 px.
- No debe haber scroll horizontal.
- Las tarjetas, los campos y el botón deben caber.
- La navegación móvil debe abrirse y cerrarse.

### Escenario B — Errores
- Confirma sin escribir nada.
- Debe aparecer un mensaje junto al primer campo incorrecto.
- El foco debe ir al primer error.
- Introduce un correo sin arroba o sin dominio válido y comprueba la respuesta.

### Escenario C — Accesibilidad
- Desde la parte superior usa solo Tab y Enter.
- Debes poder acceder a la navegación, elegir un taller y completar el formulario.
- El indicador de foco debe ser visible.
- Comprueba que cada input tiene su correspondiente label.

### Escenario D — Confirmación
- Completa una reserva usando datos ficticios.
- Debe mostrarse el taller elegido, la fecha, el nombre y una referencia.
- Pulsa «Hacer otra reserva» para comprobar que el formulario vuelve a su estado inicial.

## 5. Entrega GitHub

Estructura:

    techlab-workshops/
    ├── index.html   # Estructura y contenido de la página
    ├── styles.css   # Diseño responsive y estados visuales
    ├── app.js       # Selección, validación y confirmación
    └── README.md    # Guía y casos de prueba

1. Crea un repositorio público, por ejemplo techlab-workshops-hci.
2. Sube estos cuatro archivos a la raíz del repositorio.
3. Añade al README dos capturas de tu propia versión: escritorio y móvil.
4. Si quieres publicar la web, configura **Settings → Pages → Deploy from a branch → main → /(root)**.
5. Entrega la URL del repositorio y, si lo has publicado, la URL de GitHub Pages.

## 6. Propuestas para ampliar la práctica

- **Nivel 1:** añade un cuarto taller.
- **Nivel 2:** incorpora un contador de plazas simuladas.
- **Nivel 3:** permite escoger horario y valida que la fecha no esté vacía.
- **Nivel 4:** prueba modo oscuro con CSS y respeta prefers-reduced-motion.
- **Nivel 5:** implementa un resumen previo y un paso final de confirmación.

## 7. Preguntas para debatir en clase

1. ¿Por qué se resalta la tarjeta seleccionada y también aparece en el resumen?
2. ¿Cómo se evitan errores sin obligar al usuario a entender códigos técnicos?
3. ¿Qué cambia al navegar por teclado en lugar de con ratón?
4. ¿Qué elementos deben mantenerse visibles en móvil?
5. ¿Por qué un formulario correcto no implica necesariamente una buena experiencia de usuario?

**Criterio docente:** valorar la capacidad para completar la tarea, la accesibilidad, la adaptación al contexto y la calidad del feedback, además de la apariencia visual.
