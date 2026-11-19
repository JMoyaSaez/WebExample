# MARS CONTROL — Laboratorio de diseño responsive (HCI)

Una web **real, navegable y responsive**, construida con **HTML5, CSS3 y JavaScript sin librerías externas**. Está inspirada en un panel de seguimiento de un rover en Marte y pensada como material docente para la Unidad 8 de HCI.

> Todos los indicadores, coordenadas, operaciones y datos de misión son **ficticios**. No se conecta con ninguna misión espacial real.

## 1. Cómo abrirla

1. Descarga y descomprime el proyecto.
2. Abre `index.html` con Chrome, Firefox, Edge o Safari. No necesitas instalar nada.
3. Para una experiencia más parecida a producción, puedes utilizar la extensión **Live Server** de VS Code. Esta opción también permite que funcione «Copiar código» en navegadores que restringen el portapapeles al abrir archivos directamente.

## 2. Explora la demo

| Acción | Qué observar desde HCI |
| --- | --- |
| Pulsa **Escritorio / Tablet / Móvil** | El mismo HTML se reorganiza sin crear versiones distintas. |
| Abre **Modo aprender CSS** | Aparecen los conceptos `%`, `em`, `rem`, `fr` y `auto-fit`, con código real y retos. |
| Pulsa **Simular lectura** | Los indicadores cambian y la interfaz proporciona feedback inmediato. |
| Busca `viento` o `radiación` | Las tarjetas se atenúan o destacan y se informa de los resultados. |
| Entra en **Comandos** | Ejecuta una acción ficticia, recibe confirmación y observa el historial. |
| Pulsa **Ver ficha técnica** | La información secundaria aparece solo cuando se solicita. |

## 3. El recorrido educativo: cinco conceptos CSS

### `%`: tamaños relacionados con el contenedor

```css
.rover-picture {
  width: 60%;
}
```

**Experimenta:** alterna entre escritorio y móvil. El 60 % sigue siendo el mismo porcentaje, pero representa un tamaño físico distinto.

### `em`: tamaños relativos al elemento

```css
.btn {
  font-size: .75rem;
  padding: .76em 1.05em;
}
```

**Experimenta:** aumenta el `font-size` del botón. Su `padding` aumenta también porque está expresado en `em`.

### `rem`: una escala coherente

```css
:root {
  font-size: 16px;
}

.card {
  padding: 1.45rem;
}
```

**Experimenta:** modifica la fuente raíz o el zoom del navegador. Observa cómo se conserva la proporción de espacios.

### `fr`: reparto del espacio en Grid

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr);
}
```

**Experimenta:** cambia los dos valores por `1fr 1fr` y observa el reparto del espacio. `minmax(0, ...)` permite que el contenido se encoja sin desbordar la cuadrícula.

### `auto-fit` y `minmax`: columnas automáticas

```css
.sensor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr));
}
```

**Experimenta:** reduce el ancho disponible. Las tarjetas se distribuyen automáticamente según el espacio real. No necesitas una regla distinta para cada sensor.

Además se utilizan **media queries**, **container queries**, Flexbox, propiedades personalizadas de CSS y animaciones moderadas. Encontrarás marcas `data-unit` en el HTML para visualizar qué partes utilizan las distintas técnicas.

## 4. Actividad para el alumnado — 30 minutos

**Reto:** crea tu propio panel de control responsive usando la misma información de un rover, un dron, una nave o una estación meteorológica. No copies los colores ni la distribución tal cual: demuestra que has tomado decisiones de diseño.

1. **5 min — Analiza:** haz una captura de escritorio y otra de móvil. Identifica jerarquía visual, navegación, tarjetas y posibles puntos débiles.
2. **10 min — Construye:** crea `index.html` y `styles.css` con estructura semántica, al menos cuatro tarjetas, navegación y un bloque destacado. Usa Grid o Flexbox.
3. **8 min — Hazlo responsive:** incorpora al menos una *media query* y dos medidas relativas (`%`, `em`, `rem` o `fr`). Comprueba que no haya scroll horizontal en 390 px.
4. **5 min — Explica decisiones:** escribe en el `README.md` tres decisiones HCI: qué priorizas, cómo cambia en móvil y qué feedback recibe el usuario.
5. **2 min — Entrega:** sube el repositorio a GitHub. Incluye dos capturas (`desktop.png` y `mobile.png`) y el enlace en el README.

**Ampliación opcional:** usa JavaScript para cambiar valores con un botón, mostrar un mensaje de estado o abrir una ventana de detalles.

### Criterios de evaluación orientativos (10 puntos)

| Criterio | Puntos |
| --- | ---: |
| Estructura HTML5 semántica y orden lógico | 2 |
| Diseño responsive funcional en escritorio y móvil | 3 |
| Claridad, jerarquía visual, contraste y accesibilidad básica | 2 |
| Uso y explicación de unidades relativas / Grid / Flexbox | 2 |
| GitHub, README y capturas | 1 |

## 5. Archivos

```text
mars-control/
├── index.html          # Estructura semántica y componentes
├── styles.css          # Diseño visual, Grid, container queries y responsive
├── app.js              # Simulaciones, comandos e inspector didáctico
├── assets/
│   └── rover.png       # Ilustración con transparencia
└── README.md           # Esta guía de exploración y actividad
```

## 6. Cómo subirlo a GitHub

1. Entra en GitHub y crea un repositorio público llamado, por ejemplo, `mars-control-responsive`.
2. Selecciona **Add file → Upload files** y arrastra los archivos del proyecto, **incluida la carpeta `assets`**.
3. Confirma los cambios con **Commit changes**.
4. Para publicar una URL opcional: ve a **Settings → Pages** y selecciona la rama `main` y la carpeta `/ (root)`; espera a que GitHub muestre la URL publicada.

> Para una entrega docente básica, subir el repositorio es suficiente. La publicación en GitHub Pages es un extra útil para comprobar el resultado desde un móvil real.

## 7. Preguntas para la puesta en común

- ¿Qué información necesita ver primero una persona que supervisa un sistema?
- ¿Por qué en móvil algunos bloques cambian de posición y otros se mantienen visibles?
- ¿Cuándo utilizarías `%`, `em`, `rem`, `fr` o `auto-fit`?
- ¿Cuál es la diferencia entre *responsive* (adaptación visual) y una buena UX (claridad, accesibilidad y feedback)?
- Si una lectura fuese peligrosa, ¿qué cambiarías para reducir el riesgo de error humano?
