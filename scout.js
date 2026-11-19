"use strict";
(function(){
 const host=document.getElementById("panel-recipes"),core=window.RockpeaksScoutCore;
 if(!host||!core)return;
 const panel=document.createElement("section");panel.className="card";
 panel.innerHTML='<h2>📊 Comparador de oportunidades</h2><p class="muted">Compara recetas de cocina, alquimia y peletería usando precios de subasta y NPC. Resultados teóricos, no ventas registradas ni garantía de poder aprender la receta.</p>'+
 '<p><button id="scout-load">Analizar oportunidades</button></p><p id="scout-status" role="status" aria-live="polite">Sin datos. Se consultan cuando pulses el botón.</p>'+
 '<div id="scout-controls" hidden><div class="row"><label>Canal de venta<select id="scout-channel"><option value="npc">NPC · venta directa</option><option value="ah">Subasta · venta potencial</option></select></label>'+
 '<label>Profesión<select id="scout-prof"><option value="all">Todas</option><option value="cooking">Cocina</option><option value="alchemy">Alquimia</option><option value="leatherworking">Peletería</option></select></label></div>'+
 '<div class="row"><label>Ordenar<select id="scout-sort"><option value="profit">Mayor beneficio</option><option value="roi">Mayor rentabilidad %</option><option value="cost">Menor coste</option><option value="demand">Más ventas inferidas</option></select></label>'+
 '<label>Presupuesto (oros)<input id="scout-budget" type="number" inputmode="decimal" step=".01" min="0" placeholder="Sin límite"></label></div>'+
 '<div class="row"><label>Buscar receta o ingrediente<input id="scout-query" placeholder="Nombre o ID"></label>'+
 '<label id="scout-fee-label">Comisión subasta (%)<input id="scout-fee" type="number" min="0" max="100" step=".5" value="5"></label></div>'+
 '<label class="scout-check"><input id="scout-positive" type="checkbox" checked> Mostrar solo beneficio positivo</label><label class="scout-check"><input id="scout-fresh" type="checkbox" checked> Exigir precios recientes (máximo 6 horas)</label><label class="scout-check"><input id="scout-known" type="checkbox"> Solo recetas que he confirmado aprender</label></div>'+
 '<p id="scout-count" class="muted"></p><div id="scout-results"></div><p><button id="scout-more" hidden>Mostrar más</button></p>'+
 '<small>Origen: auctionhouse.tk.gg. La demanda refleja ventas inferidas, no operaciones garantizadas. No se incluyen depósitos de subasta, desplazamientos ni tiempo de venta. Verifica los precios NPC y que Rockpeaks puede fabricar la receta.</small>';
 host.append(panel);
 const e=id=>document.getElementById(id);
 const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const coins=x=>{
  if(x==null||!Number.isFinite(x))return "pendiente";
  const n=Math.round(Math.abs(x)),sg=x<0?"−":"";
  return sg+(n>=10000?Math.floor(n/10000)+"o ":"")+
    (n>=100?Math.floor(n%10000/100)+"p ":"")+(n%100)+"c";
 };
 const names=new Map([[6358,"Bocanegra graso"],[3371,"Vial vacío"],[3685,"Huevo de raptor"],[5504,"Carne de almeja ácida"]]),tried=new Set();
 const displayName=(id,original)=>{
  const translated=window.RockpeaksCatalog?.get("items",id,null);if(translated)return translated;
  if(names.has(Number(id)))return names.get(Number(id));
  if(typeof translationsById!=="undefined"&&translationsById?.has(Number(id)))return translationsById.get(Number(id));
  return original||"ID "+id;
 };
 let recipesData=null,marketData=null,loadedAt=0,analysis=null,visible=20,view=[],busy=false,translating=false;
 const child=(tag,value,cls)=>{
  const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;
 };
 async function fetchData(url){
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),25000);
  try{const r=await fetch(url,{cache:"no-store",signal:ctrl.signal});
   if(!r.ok)throw Error("HTTP "+r.status);return await r.json();
  }finally{clearTimeout(timeout)}
 }
 function recalc(){
  if(!recipesData||!marketData)return;
  const fee=Number(e("scout-fee").value);
  if(e("scout-fee").value===""||!Number.isFinite(fee)||fee<0||fee>100){
   e("scout-count").textContent="La comisión debe estar entre 0 y 100.";e("scout-results").replaceChildren();return;
  }
  analysis=core.scan(recipesData,marketData,{channel:e("scout-channel").value,fee});
  e("scout-fee-label").hidden=e("scout-channel").value==="npc";
  visible=20;render();
 }
 const snapshotTime=()=>{const n=Number(marketData?.t);return Number.isFinite(n)&&n>0?(n<1e11?n*1000:n):null};
 const ageHours=()=>{const t=snapshotTime();return t===null?null:Math.max(0,(Date.now()-t)/3600000)};
 const isStale=()=>ageHours()===null||ageHours()>6;
 function matches(){
  if(!analysis)return [];
  const prof=e("scout-prof").value,q=norm(e("scout-query").value);
  const budgetStr=e("scout-budget").value.trim(),budget=budgetStr===""?null:Number(budgetStr)*10000;
  if(budget!==null&&(!Number.isFinite(budget)||budget<0))return [];
  const rows=analysis.records.filter(r=>(prof==="all"||r.prof===prof)&&
   (!e("scout-fresh").checked||!isStale())&&
   (!e("scout-known").checked||window.RockpeaksCatalog?.learned(r.id))&&
   (!e("scout-positive").checked||r.profit>0)&&(budget===null||r.cost<=budget)&&
   (!q||norm([r.name,r.id,r.productId,r.productName,displayName(r.productId,r.productName),
     ...r.materials.flatMap(x=>[x.id,x.name,displayName(x.id,x.name)])].join(" ")).includes(q)));
  const sort=e("scout-sort").value;
  rows.sort((a,b)=>sort==="cost"?a.cost-b.cost||b.profit-a.profit:
   sort==="roi"?(b.roi??-Infinity)-(a.roi??-Infinity)||b.profit-a.profit:
   sort==="demand"?(b.vol24??-Infinity)-(a.vol24??-Infinity)||b.profit-a.profit:
   b.profit-a.profit||a.cost-b.cost);
  return rows;
 }
 function render(){
  if(!analysis)return;
  const all=matches(),out=e("scout-results");out.replaceChildren();view=all.slice(0,visible);
  const stats=analysis.stats;
  e("scout-count").textContent=all.length+" coincidencias · "+stats.valid+" recetas calculables de "+stats.total+
   " · sin datos suficientes: "+(stats.missingMaterials+stats.missingSale+stats.invalid)+
   " · mercado: "+(snapshotTime()?new Date(snapshotTime()).toLocaleString("es-ES"):"sin hora")+ (isStale()?" · PRECIOS ANTIGUOS O SIN FECHA: no comprar sin actualizar":"");
  if(!all.length)out.append(child("p",isStale()&&e("scout-fresh").checked?"Los precios tienen más de 6 horas o carecen de fecha verificable. Actualiza el mercado antes de decidir compras; desactiva el filtro de actualidad solo para consultar estimaciones antiguas.":"No hay coincidencias. Prueba sin el filtro de beneficio positivo o aumenta el presupuesto.","muted"));
  view.forEach(r=>{
   const item=document.createElement("article");item.className="scout-opportunity";item.dataset.outcome=r.profit>0?"profit":r.profit<0?"loss":"even";
   const head=document.createElement("div");head.className="scout-top";
   head.append(child("strong",displayName(r.productId,r.productName),"scout-name"),
    child("strong",(r.profit>=0?"+":"")+coins(r.profit),"scout-profit"));item.append(head);
   const spanishRecipe=Boolean(window.RockpeaksCatalog?.isTranslated("recipes",r.id));
   const translatedProduct=Boolean(window.RockpeaksCatalog?.isTranslated("items",r.productId));
   const recipeName=spanishRecipe?window.RockpeaksCatalog.get("recipes",r.id,r.name):
    translatedProduct?"Fabricar: "+window.RockpeaksCatalog.get("items",r.productId,r.productName):r.name;
   const recipeLanguage=spanishRecipe?"receta en español verificada":
    translatedProduct?"nombre del producto en español; receta pendiente de traducir":"nombre original sin traducir";
   const learned=Boolean(window.RockpeaksCatalog?.learned(r.id));
   item.append(child("small",r.profession+" · "+recipeName+" ("+recipeLanguage+") · receta #"+r.id+" · producto #"+r.productId+
    (learned?" · ✓ Aprendida (confirmada por ti)":" · Aprendizaje no confirmado"),"muted"));
   if(window.RockpeaksCatalog){
    const knownButton=document.createElement("button");knownButton.type="button";
    knownButton.textContent=learned?"✓ Ya la aprendí":"Marcar como aprendida";
    knownButton.className="scout-learned";
    knownButton.onclick=()=>{
     const ok=window.RockpeaksCatalog.setLearned(r.id,!window.RockpeaksCatalog.learned(r.id));
     if(!ok)e("scout-status").textContent="No se pudo guardar en este navegador.";
     render();
    };item.append(knownButton);
   }
   item.append(child("p","Materiales "+coins(r.cost)+" · Ingreso neto "+coins(r.revenue)+" · "+r.yieldCount+" unidades"+
    (r.roi===null?"":" · Rentabilidad "+r.roi.toFixed(1)+"%"),"scout-stats"));
   if(r.channel==="ah"){
    item.append(child("p","Ventas inferidas 24h: "+(r.vol24===null?"sin datos":r.vol24)+
      " · confirmadas: "+(r.sure24===null?"sin datos":r.sure24)+
      " · ofertadas: "+(r.listedUnits===null?"sin datos":r.listedUnits)+
      ". Precio anunciado, no venta garantizada.","scout-demand"));
   }else{
    item.append(child("p","Venta a NPC según precio publicado. Verifica disponibilidad y costes de los materiales.","scout-demand"));
   }
   const details=document.createElement("details"),sum=document.createElement("summary");sum.textContent="Materiales y fuentes de precio";details.append(sum);
   for(const m of r.materials)details.append(child("p",m.count+" × "+displayName(m.id,m.name)+" · "+coins(m.unitPrice)+"/ud. ("+m.source+") · total "+coins(m.unitPrice*m.count),"scout-material"));
   item.append(details);out.append(item);
  });
  e("scout-more").hidden=visible>=all.length;
  localizeVisible();
 }
 function refreshVisibleNames(){
  [...e("scout-results").querySelectorAll(".scout-opportunity")].forEach((node,i)=>{
   const rec=view[i];if(!rec)return;
   const heading=node.querySelector(".scout-name");if(heading)heading.textContent=displayName(rec.productId,rec.productName);
   node.querySelectorAll(".scout-material").forEach((p,j)=>{const m=rec.materials[j];
    if(m)p.textContent=m.count+" × "+displayName(m.id,m.name)+" · "+coins(m.unitPrice)+"/ud. ("+m.source+") · total "+coins(m.unitPrice*m.count);
   });
  });
 }
 async function localizeVisible(){
  if(translating||!view.length)return;
  const ids=[...new Set(view.flatMap(r=>[r.productId,...r.materials.map(x=>x.id)]))]
   .filter(id=>Number.isSafeInteger(id)&&id>0&&!tried.has(id)&&!names.has(id)&&
    !(typeof translationsById!=="undefined"&&translationsById?.has(id)));
  if(!ids.length)return;
  translating=true;ids.forEach(id=>tried.add(id));
  try{
   const mod=await import("https://warcraftforever.com/data/latest.mjs");
   if(typeof mod?.Items?.getMany!=="function")throw Error("sin módulo de traducciones");
   let total=0;
   for(let i=0;i<ids.length;i+=50){
    const resp=await mod.Items.getMany(ids.slice(i,i+50),{locale:"esES"});
    for(const it of resp.data||[]){
     if(it?.nameLocale==="esES"&&Number.isSafeInteger(Number(it.id))&&typeof it.name==="string"&&it.name.trim()){
      names.set(Number(it.id),it.name.trim());total++;
     }
    }
   }
   if(total){refreshVisibleNames();e("scout-status").textContent="Análisis completo. "+total+" nombres españoles adicionales recuperados en esta página."}
  }catch(err){
   e("scout-status").textContent="Escáner calculado; traducciones adicionales no disponibles: "+err.message;
  }finally{translating=false}
 }
 async function load(){
  if(busy)return;
  if(recipesData&&marketData&&Date.now()-loadedAt<3600000&&!isStale()){
   recalc();e("scout-status").textContent="Recalculado con la instantánea descargada; sin volver a consultar antes de una hora.";return;
  }
  busy=true;e("scout-load").disabled=true;e("scout-status").textContent="Consultando recetas y mercado de la Horda (EU PvP)…";
  try{
   const available=window.rockpeaksMarketSnapshot;
   const snapshotMs=Number(available?.t);const snapshotAge=Number.isFinite(snapshotMs)&&snapshotMs>0?Date.now()-(snapshotMs<1e11?snapshotMs*1000:snapshotMs):Infinity;
   const marketPromise=available&&Array.isArray(available.items)&&Array.isArray(available.f)&&snapshotAge>=0&&snapshotAge<3600000?
    Promise.resolve(available):fetchData("https://auctionhouse.tk.gg/api/m/eu-2-113");
   const [recipes,market]=await Promise.all([
    fetchData("https://auctionhouse.tk.gg/api/recipes"),marketPromise
   ]);
   if(!Array.isArray(recipes?.recipes)||!recipes?.items||!Array.isArray(market?.items)||!Array.isArray(market?.f))
    throw Error("La respuesta no tiene el formato esperado.");
   recipesData=recipes;marketData=market;loadedAt=Date.now();
   window.rockpeaksCatalogRaw=recipes;
   window.dispatchEvent(new CustomEvent("rockpeaks:catalog-ready"));
   e("scout-controls").hidden=false;recalc();
   e("scout-status").textContent="Análisis listo. Fuentes externas: mercado horario y catálogo de recetas.";
   e("scout-load").textContent="Volver a analizar";
  }catch(err){
   e("scout-status").textContent="No se pudo completar el escáner: "+err.message+". Los datos incompletos no se usan.";
  }finally{busy=false;e("scout-load").disabled=false}
 }
 e("scout-load").onclick=load;
 ["scout-channel","scout-fee"].forEach(id=>e(id).addEventListener("change",recalc));
 ["scout-prof","scout-sort","scout-budget","scout-query","scout-positive","scout-known","scout-fresh"].forEach(id=>
  e(id).addEventListener("input",()=>{visible=20;render()}));
 e("scout-more").onclick=()=>{visible+=20;render()};
 window.addEventListener("rockpeaks:translation-change",()=>{if(analysis)render()});
 window.addEventListener("rockpeaks:learned-change",()=>{if(analysis)render()});
})();
