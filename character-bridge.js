"use strict";
(function(){
 const core=window.RockpeaksCharacterCore,host=document.getElementById("panel-business");
 if(!core||!host)return;
 const key="rockpeaks-character-snapshot-v1";
 const panel=document.createElement("section");panel.className="card";
 panel.innerHTML='<h2>🛡️ Mi personaje · Rockpeaks Bridge</h2>'+
 '<p class="muted">Importa una captura local de tu personaje: oro, nivel, profesiones, materiales en las bolsas y recetas vistas como aprendidas por el cliente.</p>'+
 '<p><label>Importar archivo del addon (.lua) o captura (.json) <input id="bridge-import" type="file" accept=".lua,.json,.txt,application/json,text/plain"></label></p>'+
 '<p id="bridge-status" role="status" aria-live="polite">Sin captura importada.</p>'+
 '<div id="bridge-summary"></div>'+
 '<p><a href="./downloads/RockpeaksBridge-0.1.0.zip" download="RockpeaksBridge-0.1.0.zip">Descargar addon Rockpeaks Bridge (ZIP)</a> · <a href="https://github.com/germancillo04071984/Rockpeaksah/tree/main/addons/RockpeaksBridge" target="_blank" rel="noopener noreferrer">Instrucciones y código</a></p>'+
 '<small>Datos locales, sin subida al servidor. El inventario importado es una fotografía de las bolsas, no movimientos de compra o venta. Nunca modifica la contabilidad ni marca automáticamente recetas como aprendidas: los ID de hechizo del cliente pueden ser distintos de los ID del catálogo.</small>';
 host.prepend(panel);
 const $=id=>document.getElementById(id),summary=$("bridge-summary"),status=$("bridge-status");
 const money=n=>{const gold=Math.floor(n/10000),silver=Math.floor(n%10000/100),copper=n%100;return gold+"o "+silver+"p "+copper+"c"};
 let state=null;
 function show(value){
  summary.replaceChildren();
  if(!value){status.textContent="Sin captura importada.";return}
  const date=new Date(value.capturedAt*1000),c=value.character;
  status.textContent="Captura local: "+c.name+(c.realm?" · "+c.realm:"")+
   " · nivel "+c.level+" · "+(Number.isFinite(date.getTime())?date.toLocaleString("es-ES"):"fecha no disponible");
  function line(text){const p=document.createElement("p");p.textContent=text;summary.append(p)}
  line("Oro disponible en el personaje: "+money(c.gold)+" (no equivale al capital de Industrias Rockpeaks).");
  if(value.professions.length){
   const h=document.createElement("h3");h.textContent="Profesiones";summary.append(h);
   for(const p of value.professions)line(p.name+": "+p.rank+"/"+p.max);
  }else line("Profesiones: no se pudieron obtener. No se interpreta como ausencia de profesiones.");
  const counts=value.bagItems.reduce((sum,x)=>sum+x.count,0);
  line("Bolsas: "+value.bagItems.length+" tipos de objeto · "+counts+" unidades registradas (no incluye banco).");
  line("Recetas conocidas capturadas por el cliente: "+value.knownRecipes.length+
   ". No se han vinculado todavía al catálogo de subastas.");
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
 try{
  const cached=localStorage.getItem(key);
  if(cached){state=core.parse(cached);show(state)}
 }catch(err){status.textContent="No se pudo abrir la captura anterior. Importa una nueva: "+err.message}
 $("bridge-import").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>1000000)throw Error("El archivo supera el límite de 1 MB.");
   const next=core.parse(await file.text());
   localStorage.setItem(key,JSON.stringify(next));
   state=next;show(state);
  }catch(err){status.textContent="No se pudo importar: "+err.message+". La captura anterior se conserva."}
  finally{event.target.value=""}
 });
 window.addEventListener("rockpeaks:translation-change",()=>{if(state)show(state)});
})();
