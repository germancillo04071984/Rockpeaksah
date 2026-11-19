"use strict";
(function(){
 const tool=window.RockpeaksCatalog,core=window.RockpeaksScoutCore;
 const host=document.getElementById("panel-recipes");
 if(!tool||!core||!host)return;
 const box=document.createElement("section");box.className="card";
 box.innerHTML='<h2>🌍 Traducción y validación del catálogo</h2>'+
 '<p class="muted">Consulta los nombres oficiales españoles por ID y guarda cada lote traducido en este iPhone. El resto no se inventa. Una receta de los archivos no implica que tu personaje la haya aprendido.</p>'+
 '<p><button id="catalog-translate" type="button">Completar traducciones disponibles</button> <button id="catalog-stop" type="button" disabled>Detener después del lote actual</button></p>'+
 '<p id="catalog-status" role="status" aria-live="polite">Preparado.</p><progress id="catalog-progress" value="0" max="100" style="width:100%" hidden></progress>'+
 '<p id="catalog-stats" class="muted"></p><small>La fuente pública de profesiones puede devolver inglés cuando falta una traducción. Solo se guardan nombres que declara expresamente «esES». Para una receta aprendida tendrás que marcarla como tal desde su ficha.</small>';
 host.append(box);
 const e=id=>document.getElementById(id);
 const int=x=>x!==null&&x!==undefined&&x!==""&&Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
 let running=false;
 function describe(){
  const c=tool.counts();
  const raw=window.rockpeaksCatalogRaw;
  let totals=null;
  if(raw&&Array.isArray(raw.recipes)){
   const chosen=raw.recipes.filter(r=>core.profession(r?.prof));
   const ids=[...new Set(chosen.flatMap(r=>[
    int(r.item),...(Array.isArray(r.r)?r.r.map(x=>Array.isArray(x)?int(x[0]):null):[])
   ]).filter(Boolean))];
   const rid=[...new Set(chosen.map(r=>int(r.id)).filter(Boolean))];
   totals={recipes:rid.length,items:ids.length,translatedRecipes:rid.filter(id=>tool.isTranslated("recipes",id)).length,
    translatedItems:ids.filter(id=>tool.isTranslated("items",id)).length,
    recipesWithSpanishProduct:chosen.filter(r=>int(r.item)&&tool.isTranslated("items",int(r.item))).length};
  }
  e("catalog-stats").textContent=totals?
   "Entre las recetas de las tres profesiones: "+totals.translatedRecipes+"/"+totals.recipes+
   " nombres de receta verificados en español y "+totals.translatedItems+"/"+totals.items+
   " nombres de producto/material. Recetas cuyo producto está identificado en español: "+totals.recipesWithSpanishProduct+"/"+totals.recipes+". Recetas marcadas como aprendidas: "+c.learned+".":
   "Guardados: "+c.recipes+" nombres de recetas, "+c.items+" nombres de objetos. Recetas marcadas como aprendidas: "+c.learned+
   ". Para medir la cobertura completa es necesario consultar el catálogo.";
 }
 describe();
 function setBusy(value){
  running=value;
  e("catalog-translate").disabled=value;
  e("catalog-stop").disabled=!value;
 }
 async function catalogue(){
  if(window.rockpeaksCatalogRaw?.recipes&&window.rockpeaksCatalogRaw?.items)return window.rockpeaksCatalogRaw;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);
  try{
   const response=await fetch("https://auctionhouse.tk.gg/api/recipes",{cache:"no-store",signal:abort.signal});
   if(!response.ok)throw Error("HTTP "+response.status);
   const body=await response.json();
   if(!Array.isArray(body?.recipes)||!body?.items||typeof body.items!=="object")
    throw Error("El proveedor no devolvió un catálogo válido.");
   window.rockpeaksCatalogRaw=body;
   return body;
  }finally{clearTimeout(timer)}
 }
 e("catalog-translate").onclick=async()=>{
  if(running)return;
  setBusy(true);e("catalog-progress").hidden=false;e("catalog-progress").value=0;
  e("catalog-status").textContent="Consultando el catálogo de las tres profesiones…";
  try{
   const raw=await catalogue();
   const selected=raw.recipes.filter(r=>core.profession(r?.prof));
   const itemIds=[...new Set(selected.flatMap(r=>[
    int(r.item),...(Array.isArray(r.r)?r.r.map(x=>Array.isArray(x)?int(x[0]):null):[])
   ]).filter(Boolean))];
   const recipeIds=[...new Set(selected.map(r=>int(r.id)).filter(Boolean))];
   if(!itemIds.length&&!recipeIds.length)throw Error("No se encontraron recetas con IDs válidos.");
   describe();
   const summary=await tool.translateAll({items:itemIds,recipes:recipeIds},status=>{
    const pct=status.pending?Math.floor(status.reviewed/status.pending*100):100;
    e("catalog-progress").value=Math.min(pct,100);
    e("catalog-status").textContent="Consulta española: "+status.reviewed+"/"+status.pending+
     " ID revisados ("+pct+"%). Nuevos nombres esES: "+status.translated+
     " · lotes sin respuesta: "+status.failed+" ID.";
    describe();
   });
   const totals={recipes:recipeIds.filter(id=>tool.isTranslated("recipes",id)).length,
    items:itemIds.filter(id=>tool.isTranslated("items",id)).length};
   const all=totals.recipes===recipeIds.length&&totals.items===itemIds.length;
   e("catalog-status").textContent=(all?"Traducción disponible completa.":summary.partial?"Traducción detenida; progreso guardado.":"Revisión de IDs terminada; quedan traducciones no disponibles en el proveedor.")+
    " Recetas "+totals.recipes+"/"+recipeIds.length+" · productos/materiales "+totals.items+"/"+itemIds.length+
    ". Nuevos en esta sesión: "+summary.translated+(summary.failed?" · consultas fallidas: "+summary.failed:"")+
    ". La cobertura no equivale a recetas aprendidas.";
   describe();
  }catch(err){
   e("catalog-status").textContent="No se ha podido terminar la traducción: "+err.message+
    ". Los nombres que ya se habían guardado siguen disponibles.";
  }finally{setBusy(false)}
 };
 e("catalog-stop").onclick=()=>{
  tool.stopBatch();e("catalog-status").textContent="Deteniendo después del lote actual. Los nombres revisados quedan guardados.";
 };
 window.addEventListener("rockpeaks:catalog-ready",describe);
 window.addEventListener("rockpeaks:translation-change",describe);
 window.addEventListener("rockpeaks:learned-change",describe);
})();
