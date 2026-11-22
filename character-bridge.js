"use strict";
(function(){
 const core=window.RockpeaksCharacterCore,host=document.getElementById("panel-business");
 if(!core||!host)return;
 const key="rockpeaks-character-snapshot-v1";
 const panel=document.createElement("section");panel.className="card";
 panel.innerHTML='<h2>🛡️ Mi personaje · Rockpeaks Bridge</h2>'+
 '<p class="muted">Sincroniza automáticamente tus datos del juego en Chrome o Edge para PC. También puedes importar archivos manualmente.</p>'+
 '<p><label>Importar archivo del addon (.lua) o captura (.json) <input id="bridge-import" type="file" accept=".lua,.json,.txt,application/json,text/plain"></label></p>'+
 '<p><button id="bridge-demo" type="button">Probar con datos de ejemplo</button></p>'+ 
 '<p id="bridge-status" role="status" aria-live="polite">Sin captura importada.</p>'+
 '<div id="bridge-summary"></div>'+
 '<p><a href="./downloads/RockpeaksBridge-0.2.0.zip" download="RockpeaksBridge-0.2.0.zip">Descargar addon Rockpeaks Bridge (ZIP)</a> · <a href="https://github.com/germancillo04071984/Rockpeaksah/tree/main/addons/RockpeaksBridge" target="_blank" rel="noopener noreferrer">Instrucciones y código</a></p>'+
 '<small>Datos locales, sin subida al servidor. El inventario importado es una fotografía de las bolsas, no movimientos de compra o venta. Nunca modifica la contabilidad ni marca automáticamente recetas como aprendidas: los ID de hechizo del cliente pueden ser distintos de los ID del catálogo.</small>';
 host.prepend(panel);
 const $=id=>document.getElementById(id),summary=$("bridge-summary"),status=$("bridge-status");
 const money=n=>{const gold=Math.floor(n/10000),silver=Math.floor(n%10000/100),copper=n%100;return gold+"o "+silver+"p "+copper+"c"};
 let state=null,demoOn=false;
 const example={schema:"rockpeaks-character-v1",version:1,capturedAt:1795356000,
  character:{name:"Rockpeaks",realm:"EU PvP (ejemplo)",level:31,gold:18234},
  professions:[{name:"Alquimia",rank:75,max:150,id:171},{name:"Cocina",rank:150,max:150,id:185}],
  bagItems:[{id:3685,count:32},{id:3371,count:12},{id:6358,count:5}],
  knownRecipes:[{id:718,name:"Aceite de bocanegra"}],
  diagnostics:{professions:{state:"available",reason:""},
   bags:{state:"available",reason:""},recipes:{state:"available",reason:""}}};
 function show(value,asDemo=false){
  demoOn=asDemo;
  const demoButton=$("bridge-demo");
  demoButton.textContent=asDemo?"Salir de la demostración":"Probar con datos de ejemplo";
  summary.replaceChildren();
  if(!value){status.textContent="Sin captura importada.";return}
  const date=new Date(value.capturedAt*1000),c=value.character;
  status.textContent=(asDemo?"DEMOSTRACIÓN · DATOS FICTICIOS · ":"Captura local: ")+c.name+(c.realm?" · "+c.realm:"")+
   " · nivel "+c.level+" · "+(Number.isFinite(date.getTime())?date.toLocaleString("es-ES"):"fecha no disponible");
  function line(text){const p=document.createElement("p");p.textContent=text;summary.append(p)}
  line("Oro disponible en el personaje: "+money(c.gold)+" (no equivale al capital de Industrias Rockpeaks).");
  const qualities={available:"Lectura disponible",partial:"Lectura parcial",
   unavailable:"API no disponible",unobserved:"No se ha observado una ventana de profesión"};
  function quality(field){
   const report=value.diagnostics?.[field];
   const level=report?.state?qualities[report.state]||"No verificado":"Estado no informado por el addon";
   line("Calidad de lectura · "+field+": "+level+
    (report?.reason?". "+report.reason:""));
  }
  if(value.professions.length){
   const h=document.createElement("h3");h.textContent="Profesiones";summary.append(h);
   for(const p of value.professions)line(p.name+": "+p.rank+"/"+p.max);
  }else line("Profesiones: ningún dato capturado; no implica que el personaje no tenga.");
  quality("professions");
  const counts=value.bagItems.reduce((sum,x)=>sum+x.count,0);
  line("Bolsas: "+value.bagItems.length+" tipos de objeto · "+counts+
   " unidades capturadas (sin banco). Una lectura incompleta no representa todo tu inventario.");
  quality("bags");
  line("Recetas capturadas por el cliente: "+value.knownRecipes.length+
   ". No se han vinculado todavía al catálogo de subastas.");
  quality("recipes");
  const details=document.createElement("details"),heading=document.createElement("summary");
  heading.textContent="Ver materiales importados por ID";details.append(heading);
  const list=document.createElement("div");
  const ordered=value.bagItems.slice().sort((a,b)=>b.count-a.count||a.id-b.id);
  for(const item of ordered.slice(0,60)){
   const name=window.RockpeaksCatalog?.get("items",item.id,null);
   const p=document.createElement("p");
   p.textContent=item.count+" × "+(name||"Objeto ID "+item.id)+" (ID "+item.id+")";list.append(p);
  }
  if(ordered.length>60){const p=document.createElement("p");p.textContent="Mostrando 60 de "+ordered.length+" tipos. La captura completa permanece guardada.";list.append(p)}
  details.append(list);summary.append(details);
 }
 $("bridge-demo").onclick=()=>show(demoOn?state:example,!demoOn);
 function persistSnapshot(value,mode="manual"){
  const next=core.validate(value);
  if(mode==="auto"&&state&&next.capturedAt<state.capturedAt)return false;
  localStorage.setItem(key,JSON.stringify(next));
  state=next;show(state);
  if(mode==="auto")status.textContent+=" · sincronizada automáticamente";
  return true;
 }
 window.RockpeaksCharacterBridge=Object.freeze({importSnapshot(value){return persistSnapshot(value,"auto")}});
 try{
  const cached=localStorage.getItem(key);
  if(cached){state=core.parse(cached);show(state)}
 }catch(err){status.textContent="No se pudo abrir la captura anterior. Importa una nueva: "+err.message}
 $("bridge-import").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>1000000)throw Error("El archivo supera el límite de 1 MB.");
   persistSnapshot(core.parse(await file.text()));
  }catch(err){status.textContent="No se pudo importar: "+err.message+". La captura anterior se conserva."}
  finally{event.target.value=""}
 });
 window.addEventListener("rockpeaks:translation-change",()=>{if(state)show(state)});
})();
