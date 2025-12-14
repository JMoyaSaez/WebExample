html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #05060a;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

#c {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
}

#hud {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 10;
  color: rgba(255, 255, 255, 0.88);
  user-select: none;
  pointer-events: none;
}

.title {
  font-weight: 700;
  letter-spacing: 0.4px;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  width: fit-content;
}

.hint,
.stats {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.25;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
  width: fit-content;
  max-width: 520px;
  color: rgba(255, 255, 255, 0.78);
}
