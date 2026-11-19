/* Ejemplo educativo: todos los valores son simulados. Sin librerías externas. */
"use strict";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const initial = { temperature:-23, radiation:21, wind:32, battery:88, signal:93, mission:76 };
let state = {...initial};
let updates = 0;
let toastTimer;
const cssLessons = {
  percent: {
    label:"MEDIDAS RELATIVAS",title:"Porcentaje (%)",
    description:"Un porcentaje de ancho toma como referencia el contenedor. La imagen del rover ocupa parte del ancho que tiene disponible, sea grande o pequeño.",
    task:"Cambia de escritorio a móvil. El 60 % pasa a representar una anchura diferente.",
    code:".rover-picture {\n  width: 60%;\n}\n.app-shell {\n  width: min(100%, var(--preview-width));\n}"
  },
  em: {
    label:"RELATIVO AL TEXTO",title:"Unidad em",
    description:"En propiedades como padding, la unidad em depende del tamaño del texto del elemento. El espacio interior crece si aumenta su fuente.",
    task:"En styles.css aumenta el font-size de .btn y observa también su padding.",
    code:".btn {\n  font-size: .75rem;\n  padding: .76em 1.05em;\n}"
  },
  rem: {
    label:"ESCALA GLOBAL",title:"Unidad rem",
    description:"rem depende de la fuente del elemento raíz. Ayuda a crear una escala coherente de tamaños y separaciones.",
    task:"Amplía el zoom del navegador al 125 % y compara los tamaños de los componentes.",
    code:":root { font-size: 16px; }\n.card {\n  padding: 1.45rem;\n  border-radius: 1.35rem;\n}"
  },
  fr: {
    label:"REPARTO DEL ESPACIO",title:"Unidad fr",
    description:"CSS Grid divide el espacio disponible entre columnas proporcionales. La columna izquierda recibe ligeramente más espacio.",
    task:"Cambia la distribución de 1.08fr .92fr a 1fr 1fr y compara.",
    code:".dashboard-grid {\n  display: grid;\n  grid-template-columns:\n    minmax(0, 1.08fr) minmax(0, .92fr);\n}"
  },
  "auto-fit": {
    label:"COLUMNAS FLEXIBLES",title:"auto-fit y minmax",
    description:"La cuadrícula crea tantas columnas como caben y reorganiza las tarjetas cuando el contenedor se estrecha.",
    task:"Compara escritorio, tablet y móvil. Cuenta las columnas de los sensores.",
    code:".sensor-grid {\n  grid-template-columns:\n    repeat(auto-fit,\n      minmax(min(100%, 7rem), 1fr));\n}"
  }
};
function toast(message) {
  const el=$("#toast");
  el.textContent=message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}
function random(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function text(id,value){document.getElementById(id).textContent=value;}
function drawChart() {
  const energy=[38,44,45,43,53,70,74,73,88,100,94,80,74,67,76,65,49,55,72,83];
  const used=[97,94,76,42,51,60,64,57,50,55,59,53,49,39,43,47,37,29,32,35];
  const draw=(array,variation)=>array.map((v,i)=>{
    const x=i/(array.length-1)*620;
    const y=242-(v+Math.sin(i*1.8+updates)*variation)*1.78;
    return (i===0?"M":"L")+" "+x.toFixed(1)+" "+y.toFixed(1);
  }).join(" ");
  const e=draw(energy,updates?3:0),u=draw(used,updates?2:0);
  $("#energyLine").setAttribute("d",e);
  $("#usedLine").setAttribute("d",u);
  $("#energyArea").setAttribute("d",e+" L620 260 L0 260 Z");
  $("#usedArea").setAttribute("d",u+" L620 260 L0 260 Z");
}
function render() {
  $("#temperatureValue").innerHTML=(state.temperature<0?"−":"")+Math.abs(state.temperature)+"<small>°C</small>";
  $("#radiationValue").innerHTML=state.radiation+"<small>%</small>";
  $("#windValue").innerHTML=state.wind+"<small>km/h</small>";
  $("#temperatureTrack").style.setProperty("--level",clamp(48+state.temperature/4,8,92)+"%");
  $("#radiationTrack").style.setProperty("--level",state.radiation+"%");
  $("#windTrack").style.setProperty("--level",clamp(state.wind*1.4,5,100)+"%");
  text("batteryValue",state.battery+"%");
  $("#batteryRing").style.setProperty("--level",state.battery);
  text("healthValue",(9.1-(88-state.battery)*.015).toFixed(1).replace(".",",")+"/10");
  text("signalValue",state.signal+"%");
  $("#signalNeedle").style.transform="rotate("+((state.signal/100)*135-68)+"deg)";
  text("missionValue",state.mission+"%");
  $("#missionTrack").style.setProperty("--level",state.mission+"%");
  text("detailsBattery",state.battery+"%");
  text("lastUpdate","Actualizado "+new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}));
  drawChart();
}
$("#simulateButton").addEventListener("click",()=>{
  updates++;
  state.temperature=clamp(state.temperature+random(-3,3),-36,8);
  state.radiation=clamp(state.radiation+random(-4,4),8,54);
  state.wind=clamp(state.wind+random(-7,7),6,65);
  state.battery=clamp(state.battery-random(0,2),30,100);
  state.signal=clamp(state.signal+random(-6,4),48,99);
  state.mission=clamp(state.mission+random(0,2),76,99);
  render();toast("Nueva lectura simulada. Observa cómo cambian los indicadores.");
});
$("#resetButton").addEventListener("click",()=>{
  state={...initial};updates=0;render();toast("Valores iniciales restaurados.");
});
function measurements(){
  const width=Math.round($("#appShell").getBoundingClientRect().width);
  const columns=getComputedStyle($("#sensorGrid")).gridTemplateColumns.split(" ").filter(Boolean).length;
  text("viewportSize","Interfaz: "+width+" px");
  text("actualWidth",width+" px");
  text("sensorColumns",String(columns));
  text("rootSize",getComputedStyle(document.documentElement).fontSize);
}
$$("[data-viewport]").forEach((button)=>button.addEventListener("click",()=>{
  const widths={desktop:"100%",tablet:"820px",mobile:"390px"};
  $("#appShell").style.setProperty("--preview-width",widths[button.dataset.viewport]);
  $$("[data-viewport]").forEach((b)=>{
    const selected=b===button;
    b.classList.toggle("active",selected);
    b.setAttribute("aria-pressed",String(selected));
  });
  toast("Simulación de pantalla: "+button.textContent+".");
  setTimeout(measurements,380);
}));
if("ResizeObserver" in window)new ResizeObserver(measurements).observe($("#appShell"));
window.addEventListener("resize",measurements);
function selectLesson(name){
  const lesson=cssLessons[name];if(!lesson)return;
  text("lessonLabel",lesson.label);text("lessonTitle",lesson.title);
  text("lessonText",lesson.description);text("lessonTask",lesson.task);
  text("lessonCode",lesson.code);
  $$(".concept").forEach((b)=>{
    b.classList.toggle("selected",b.dataset.concept===name);
    b.setAttribute("aria-pressed",String(b.dataset.concept===name));
  });
}
function toggleLearning(forced){
  const enabled=typeof forced==="boolean"?forced:$("#learningPanel").hidden;
  $("#learningPanel").hidden=!enabled;
  $("#appShell").dataset.learning=String(enabled);
  $("#lessonToggle").setAttribute("aria-pressed",String(enabled));
  if(enabled){measurements();$("#learningPanel").scrollIntoView({block:"nearest",behavior:"smooth"});}
}
$("#lessonToggle").addEventListener("click",()=>toggleLearning());
$("#cssNav").addEventListener("click",()=>toggleLearning(true));
$$(".concept").forEach((b)=>b.addEventListener("click",()=>selectLesson(b.dataset.concept)));
$("#copyButton").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("#lessonCode").textContent);toast("Código CSS copiado.");}
  catch{toast("Selecciona el código para copiarlo manualmente.");}
});
$("#searchInput").addEventListener("input",(event)=>{
  const query=event.target.value.trim().toLocaleLowerCase("es");
  let count=0;
  $$(".sensor").forEach((card)=>{
    const match=!query||(card.dataset.search+" "+card.textContent).toLocaleLowerCase("es").includes(query);
    card.classList.toggle("is-dimmed",!match);
    if(match)count++;
  });
  text("searchStatus",query?count+" de 3 sensores coinciden con la búsqueda.":"");
});
$("#notificationBtn").addEventListener("click",()=>{
  $("#notifications").hidden=!$("#notifications").hidden;
  $("#notificationBtn").setAttribute("aria-expanded",String(!$("#notifications").hidden));
});
document.addEventListener("click",(event)=>{
  if(!$("#notifications").contains(event.target)&&!$("#notificationBtn").contains(event.target)){
    $("#notifications").hidden=true;$("#notificationBtn").setAttribute("aria-expanded","false");
  }
});
$("#roverDetails").addEventListener("click",()=>$("#detailsDialog").showModal());
$("#commandsNav").addEventListener("click",()=>$("#commandsDialog").showModal());
$$("[data-close]").forEach((b)=>b.addEventListener("click",()=>b.closest("dialog").close()));
$$("dialog").forEach((dialog)=>dialog.addEventListener("click",(event)=>{
  if(event.target===dialog)dialog.close();
}));
$$("[data-command]").forEach((button)=>button.addEventListener("click",()=>{
  const command=button.dataset.command;
  const item=document.createElement("li");
  item.textContent=new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})+": "+command+" confirmado (simulación).";
  $("#commandLog").prepend(item);
  if($("#commandLog").children.length>5)$("#commandLog").lastElementChild.remove();
  if(command==="Comprobar enlace")state.signal=clamp(state.signal+2,0,100);
  if(command==="Analizar muestra")state.mission=clamp(state.mission+1,0,100);
  render();toast(command+": operación confirmada.");
}));
selectLesson("percent");render();measurements();
