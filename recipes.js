"use strict";
(async function(){
const root=document.createElement("section");root.className="card";root.innerHTML='<h2>📚 Catálogo de recetas de WoW Forever</h2><p class="muted">Cocina, alquimia y peletería. Datos del corpus público de profesiones; una receta en los archivos no garantiza que Rockpeaks pueda aprenderla. La cobertura y los nombres dependen de la fuente.</p><p><button id="recipe-load">Cargar catálogo completo disponible</button> <button id="recipe-stop" disabled>Detener</button> <button id="recipe-audit" disabled>Exportar auditoría CSV</button> <button id="recipe-share" disabled>Compartir CSV (iPhone)</button> <button id="recipe-copy" disabled>Copiar CSV</button> <a id="recipe-download" hidden download="rockpeaks-auditoria-recetas.csv">Guardar CSV</a></p><p id="recipe-export-status" role="status"></p><textarea id="recipe-csv-text" aria-label="Contenido del CSV" readonly hidden rows="6" style="width:100%;box-sizing:border-box"></textarea><p id="recipe-status" aria-live="polite">Sin cargar</p><p id="recipe-translation" class="muted" aria-live="polite">Nombres de ingredientes: pendientes de consulta.</p><div class="row"><label>Profesión<select id="recipe-prof"><option value="all">Todas las tres</option><option value="cooking">Cocina</option><option value="alchemy">Alquimia</option><option value="leatherworking">Peletería</option></select></label><label>Buscar<input id="recipe-search" placeholder="Receta, ingrediente o ID"></label><label>Mostrar<select id="recipe-scope"><option value="all">Todas</option><option value="complete">Estructura completa</option><option value="spanish">Nombres en español verificados</option><option value="starred">Mis favoritas</option></select></label><label>Ordenar<select id="recipe-order"><option value="name">Nombre</option><option value="id">ID de receta</option><option value="complete">Completas primero</option></select></label></div><p id="recipe-count"></p><div id="recipe-results"></div><div id="recipe-plan" class="card" hidden><h3 id="recipe-plan-title">Planificador</h3><div class="recipe-result-panel" role="status" aria-live="polite"><strong id="recipe-profit-heading">Beneficio pendiente</strong><p id="recipe-profit">Calculando…</p></div><p id="recipe-plan-info"></p><label>Fabricaciones <input id="recipe-batches" type="number" min="1" step="1" value="1"></label><div id="recipe-materials"></div><p><label>Raciones / unidades obtenidas por fabricación <input id="recipe-output" type="number" min="1" step="1" value="1"></label></p><div class="row"><label>Canal de venta<select id="recipe-channel"><option value="ah">Casa de subastas</option><option value="npc">Vendedor NPC</option></select></label><label>Venta por unidad (cobres)<input id="recipe-sale" type="number" min="0" step="1" placeholder="Precio pendiente"></label></div><p><button type="button" id="recipe-use-market">Usar precio mínimo de subasta</button></p><p><small id="recipe-price-note" aria-live="polite">Precio de venta pendiente.</small></p><div class="row"><label>Otros gastos por fabricación (cobres)<input id="recipe-other" type="number" min="0" step="1" value="0"></label><label id="recipe-fee-wrap">Comisión subasta (%) <input id="recipe-commission" type="number" min="0" max="100" step=".1" value="5"></label></div><div id="recipe-maxbuy" aria-live="polite"></div><p><label>Nombre del producto fabricado <input id="recipe-output-name" placeholder="Confirma el nombre del producto"></label></p><button id="recipe-confirm-craft">Confirmar fabricación real y mover inventario</button><small>Los precios de materiales se introducen manualmente o se toman del mercado solo cuando coinciden los ID. Un ingrediente sin precio no equivale a coste cero.</small></div><p><button id="recipe-more" hidden>Mostrar más</button></p><small>El catálogo no modifica tu contabilidad ni inventario. Revisa cantidades y disponibilidad antes de fabricar. Los precios de mercado pueden faltar.</small>';
document.getElementById("panel-recipes")?.append(root);
if(!root.isConnected)return;
const e=id=>document.getElementById(id);
let records=[],visible=0,loading=false,stop=false,mod=null,coverage="",dataset="";
const csvCell=x=>{let v=String(x??"");if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'};
const recipeAudit=()=>records.map(r=>{const ing=ingredients(r),out=r.product||r.output||r.createdItem||{};return [r._prof,r.id??r.spellId??"",title(r),r.nameLocale??"no informado",usable(r)?"estructura completa":"incompleta",out.name||out.item?.name||(isPositiveInt(out.item)?"ID "+out.item:""),out.count??out.quantity??r.outputCount??"",ing.map(x=>(x.itemId??x.item?.id??x.id??"")+":"+(x.count??x.quantity??x.amount??x.requiredCount??"")).join(";"),line(ing),dataset]});
const isPositiveInt=x=>x!==null&&x!==undefined&&x!==""&&Number.isSafeInteger(Number(x))&&Number(x)>0;
const usable=r=>{const ing=ingredients(r),out=r.product||r.output||r.createdItem||{},yieldValue=out.count??out.quantity??r.outputCount;return ing.length>0&&ing.every(x=>x&&typeof x==="object"&&!Array.isArray(x)&&isPositiveInt(x.count??x.quantity??x.amount??x.requiredCount)&&(typeof(x.name||x.item?.name||x.itemName)==="string"||isPositiveInt(x.itemId??x.item?.id??x.id)))&&isPositiveInt(yieldValue)&&(typeof(out.name||out.item?.name)==="string"||isPositiveInt(out.item)||isPositiveInt(out.item?.id))};
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const recipeKey=r=>r.id!=null||r.spellId!=null?r._prof+"|"+String(r.id??r.spellId):null;
let starredRecipes=[];
try{const saved=JSON.parse(localStorage.getItem("rockpeaks-recipe-stars-v1")||"[]");if(Array.isArray(saved))starredRecipes=saved.filter(x=>typeof x==="string")}catch{}
const professionsById=new Map([[171,"alchemy"],[165,"leatherworking"],[185,"cooking"]]);
const category=r=>{const prof=professionsById.get(Number(r.profession));if(prof)return prof;const raw=[r.profession,r.professionName,r.skillLine,r.skillLineName,r.category,r.profession?.name,r.skill?.name,r.skill?.profession].filter(Boolean).map(v=>typeof v==="object"?JSON.stringify(v):String(v)).join(" ").toLowerCase();if(/leatherworking|peleter|cuero|leatherwork/.test(raw))return"leatherworking";if(/alchemy|alquimia/.test(raw))return"alchemy";if(/cooking|cocina/.test(raw))return"cooking";return null};
const originalTitle=r=>r.name||r.spellName||r.recipeName||r.product?.name||"Receta #"+(r.id??"?");
const title=r=>window.RockpeaksCatalog?.get("recipes",r.id??r.spellId,originalTitle(r))??originalTitle(r);
const arr=x=>Array.isArray(x)?x:[];
const ingredients=r=>arr(r.reagents||r.ingredients||r.materials||r.requiredItems).map(reagent=>{
 if(Array.isArray(reagent))return {itemId:reagent[0],count:reagent[1]};
 return reagent??{};
});
// Nombres contrastados en el cliente de WoW Forever. Los demás proceden de Items.getMany(esES).
const ingredientNames=new Map([[6358,"Bocanegra graso"],[3371,"Vial vacío"]]);
const ingredientId=x=>Number(x?.itemId??x?.item?.id??x?.id);
function ingredientName(x){
 if(typeof x==="string")return x;
 const id=ingredientId(x);
 return window.RockpeaksCatalog?.get("items",id,null)||ingredientNames.get(id)||x.name||x.item?.name||x.itemName||
  (Number.isSafeInteger(id)&&id>0?"Ingrediente sin traducir (ID "+id+")":"Ingrediente sin identificar");
}
function line(ing){return arr(ing).map(x=>{if(typeof x==="string")return x;const qty=x.count??x.quantity??x.amount??x.requiredCount;return (qty!=null?qty+" × ":"")+ingredientName(x)}).join(" · ")}
function refreshNames(){
 render(false,false);
 if(planned){
  ingredients(planned).forEach((x,i)=>{
   const heading=document.getElementById("recipe-ingredient-name-"+i);
   if(heading)heading.textContent=ingredientName(x);
  });
  calc();
 }
}
async function translateIngredients(){
 const ids=[...new Set(records.flatMap(r=>ingredients(r).map(ingredientId)).filter(x=>Number.isSafeInteger(x)&&x>0))];
 let known=ids.filter(id=>ingredientNames.has(id)).length,processed=known,errors=0;
 if(!ids.length){e("recipe-translation").textContent="No hay ingredientes identificables en los registros.";return}
 if(!mod?.Items||typeof mod.Items.getMany!=="function"){
  e("recipe-translation").textContent="El proveedor no permite consultar nombres de ingredientes. "+known+"/"+ids.length+" nombres en español disponibles.";
  return;
 }
 const unresolved=ids.filter(id=>!ingredientNames.has(id));
 e("recipe-translation").textContent="Buscando nombres españoles: "+known+"/"+ids.length+" materiales distintos…";
 for(let i=0;i<unresolved.length;i+=50){
  if(stop)break;
  const batch=unresolved.slice(i,i+50);
  try{
   const response=await mod.Items.getMany(batch,{locale:"esES"});
   for(const item of response.data||[]){
    const id=Number(item?.id);
    if(item?.nameLocale==="esES"&&typeof item.name==="string"&&item.name.trim()&&Number.isSafeInteger(id)&&id>0)
     ingredientNames.set(id,item.name.trim());
   }
  }catch(err){errors++}
  processed+=batch.length;
  known=ids.filter(id=>ingredientNames.has(id)).length;
  if(i===0||i%500===0||i+50>=unresolved.length){
   e("recipe-translation").textContent="Nombres españoles: "+known+"/"+ids.length+" · IDs revisados: "+processed+"/"+ids.length+(errors?" · lotes fallidos: "+errors:"");
   refreshNames();
  }
 }
 known=ids.filter(id=>ingredientNames.has(id)).length;
 e("recipe-translation").textContent="Ingredientes con nombre español: "+known+"/"+ids.length+" · sin traducción verificada: "+(ids.length-known)+(errors?" · errores de consulta: "+errors:"")+(stop?" · revisión interrumpida":"");
 refreshNames();
}
function filtered(){
 const prof=e("recipe-prof").value,q=norm(e("recipe-search").value.trim()),scope=e("recipe-scope").value;
 const found=records.filter(r=>(prof==="all"||r._prof===prof)
  &&(scope!=="complete"||usable(r))
  &&(scope!=="spanish"||r.nameLocale==="esES")
  &&(scope!=="starred"||(recipeKey(r)&&starredRecipes.includes(recipeKey(r))))
  &&(!q||norm([title(r),originalTitle(r),r.id??r.spellId,line(ingredients(r))].join(" ")).includes(q)));
 const order=e("recipe-order").value;
 found.sort((a,b)=>order==="id"?
  (Number(a.id??a.spellId)||Infinity)-(Number(b.id??b.spellId)||Infinity):
  order==="complete"?(Number(usable(b))-Number(usable(a))||title(a).localeCompare(title(b),"es",{sensitivity:"base"})):
  title(a).localeCompare(title(b),"es",{sensitivity:"base"}));
 return found;
}
function render(reset=true,extend=true){if(reset)visible=0;const matches=filtered();visible=Math.min(matches.length,visible+(extend?40:0));const out=e("recipe-results");out.replaceChildren();matches.slice(0,visible).forEach(r=>{const d=document.createElement("div");d.style.borderTop="1px solid #475569";d.style.padding="12px 0";const h=document.createElement("strong");h.textContent=title(r)+((r.nameLocale==="esES"||window.RockpeaksCatalog?.isTranslated("recipes",r.id??r.spellId))?" [español]":" [idioma no verificado]")+" · "+({cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería"}[r._prof]||"Sin clasificar");d.append(h);const p=document.createElement("p");p.className="muted";const ings=ingredients(r);p.textContent="ID "+(r.id??"sin identificar")+" · "+(ings.length?line(ings):"Ingredientes no disponibles en este registro");d.append(p);const output=r.product||r.output||r.createdItem;const o=document.createElement("small");o.textContent=output?"Producto: "+(output.name||output.item?.name||output.itemId||output.id||"sin nombre")+" · Cantidad: "+(output.count??output.quantity??r.outputCount??"no indicada"):"Producto/cantidad: no confirmados";d.append(o);
 const opp=marketOpportunity(r),summary=document.createElement("p");summary.className="recipe-opportunity";
 if(opp.status==="estimated"){
  summary.textContent="Coste mín. "+gold(opp.cost)+" · Ingreso neto subasta "+gold(opp.revenue)+" · "+(opp.profit>=0?"Beneficio potencial ":"Pérdida potencial ")+gold(opp.profit)+(opp.profit>=0?"":" (negativo)")+" / fabricación";
  summary.dataset.outcome=opp.profit>0?"profit":opp.profit<0?"loss":"even";
 }else if(opp.status==="cost-pending"){summary.textContent="Beneficio pendiente: faltan precios de materiales."}
 else if(opp.status==="sale-pending"){summary.textContent="Coste mín. "+gold(opp.cost)+" · Beneficio pendiente: falta precio de venta."}
 else {summary.textContent="Beneficio pendiente: receta sin materiales o rendimiento verificables."}
 d.append(summary);const btn=document.createElement("button");btn.textContent=usable(r)?"Calcular fabricación":"Revisar receta incompleta";btn.onclick=()=>plan(r);d.append(document.createElement("p"),btn);const key=recipeKey(r);if(key){const star=document.createElement("button");star.type="button";star.textContent=starredRecipes.includes(key)?"★ Favorita":"☆ Marcar favorita";star.setAttribute("aria-label","Marcar o quitar receta favorita");star.onclick=()=>{starredRecipes=starredRecipes.includes(key)?starredRecipes.filter(x=>x!==key):[...starredRecipes,key];try{localStorage.setItem("rockpeaks-recipe-stars-v1",JSON.stringify(starredRecipes))}catch{e("recipe-status").textContent="No se pudieron guardar favoritos en este navegador."}render()};d.append(star);
 if(window.RockpeaksCatalog){const learned=document.createElement("button");learned.type="button";
 learned.textContent=window.RockpeaksCatalog.learned(r.id??r.spellId)?"✓ Aprendida":"¿La he aprendido?";
 learned.setAttribute("aria-label","Confirmar si Rockpeaks aprendió esta receta");
 learned.onclick=()=>{const id=r.id??r.spellId;const has=window.RockpeaksCatalog.learned(id);
  const saved=window.RockpeaksCatalog.setLearned(id,!has);
  if(!saved)e("recipe-status").textContent="No se pudo guardar la confirmación en este dispositivo.";
  render(false,false)};
 d.append(learned)}
 }out.append(d)});e("recipe-count").textContent=matches.length+" recetas coincidentes · "+records.length+" clasificadas · "+records.filter(usable).length+" con estructura completa (sin contrastar con el juego)";e("recipe-more").hidden=visible>=matches.length}
function auditCsv(){
 const rows=[["profesion","id_receta","nombre","idioma_nombre","estado_estructura","producto","cantidad_resultado","ingredientes_id_cantidad","ingredientes_nombres","dataset"],...recipeAudit()];
 return "\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");
}
const auditName="rockpeaks-auditoria-recetas.csv";
let auditText="",auditUrl="",shareFile=null;

function prepareAudit(){
 const link=e("recipe-download"),preview=e("recipe-csv-text");
 if(auditUrl)URL.revokeObjectURL(auditUrl);
 auditText="";auditUrl="";shareFile=null;
 link.removeAttribute("href");
 link.hidden=true;preview.hidden=true;preview.value="";
 e("recipe-export-status").textContent="";
 if(!records.length)return;
 auditText=auditCsv();
 const options={type:"text/csv"};
 const blob=new Blob([auditText],options);
 auditUrl=URL.createObjectURL(blob);
 link.href=auditUrl;
 if(typeof File==="function")shareFile=new File([blob],auditName,options);
}
function offerDownload(message){
 e("recipe-download").hidden=false;
 e("recipe-export-status").textContent=message;
}
e("recipe-audit").onclick=()=>{
 if(!auditUrl)return;
 offerDownload("Se ha solicitado la descarga. Puedes volver a pulsar «Guardar CSV».");
 e("recipe-download").click();
};
e("recipe-share").onclick=async()=>{
 if(!auditUrl)return;
 try{
  if(shareFile&&navigator.share&&navigator.canShare?.({files:[shareFile]})){
   await navigator.share({files:[shareFile]});
   e("recipe-export-status").textContent="Se ha compartido el CSV.";
   return;
  }
  offerDownload("Este navegador no ofrece compartir el archivo. Pulsa «Guardar CSV».");
 }catch(err){
  offerDownload(err.name==="AbortError"?"Compartir cancelado.":"No se pudo compartir. Pulsa «Guardar CSV».");
 }
};
e("recipe-copy").onclick=async()=>{
 if(!auditText)return;
 try{
  await navigator.clipboard.writeText(auditText);
  e("recipe-export-status").textContent="CSV copiado.";
 }catch{
  const preview=e("recipe-csv-text");
  preview.value=auditText;preview.hidden=false;preview.focus();preview.select();
  offerDownload("Puedes copiar el texto seleccionado o pulsar «Guardar CSV».");
 }
};
e("recipe-prof").onchange=()=>render();e("recipe-search").oninput=()=>render();e("recipe-scope").onchange=()=>render();e("recipe-order").onchange=()=>render();e("recipe-more").onclick=()=>render(false);e("recipe-stop").onclick=()=>{stop=true;e("recipe-status").textContent="Deteniendo tras la página actual…"};

let planned=null;
window.addEventListener("rockpeaks:translation-change",()=>{
 if(!loading&&records.length){render(false,false);if(planned)refreshNames()}
});
window.addEventListener("rockpeaks:learned-change",()=>{if(!loading&&records.length)render(false,false)});

const gold=n=>{if(!Number.isFinite(n))return "—";let v=Math.round(Math.abs(n)),sign=n<0?"−":"";return sign+[Math.floor(v/10000)?" "+Math.floor(v/10000)+"o":"",Math.floor(v%10000/100)?" "+Math.floor(v%10000/100)+"p":"",v%100+"c"].join(" ").trim()};
function marketPrice(id){
 if(!isPositiveInt(id)||typeof items==="undefined"||!Array.isArray(items)||typeof val!=="function")return null;
 const it=items.find(x=>Number(x.id)===Number(id));
 if(!it)return null;
 const raw=val(it,"ask");
 if(raw==null||raw===""||!Number.isFinite(Number(raw))||Number(raw)<=0)return null;
 return Math.round(Number(raw));
}
function outputItemId(r){
 const out=r.product||r.output||r.createdItem||{};
 const candidates=[out.itemId,out.item?.id,typeof out.item==="number"||typeof out.item==="string"?out.item:null,out.id,r.createdItemId,r.outputItemId,r.productItemId];
 for(const raw of candidates)if(isPositiveInt(raw))return Number(raw);
 return null;
}
function yieldPerCraft(r){
 const out=r.product||r.output||r.createdItem||{};
 const y=out.count??out.quantity??r.outputCount;
 return isPositiveInt(y)?Number(y):null;
}
function marketOpportunity(r){
 if(!usable(r))return {status:"incomplete"};
 const outputId=outputItemId(r),sale=marketPrice(outputId),yieldCount=yieldPerCraft(r);
 const ing=ingredients(r);
 let cost=0;
 for(const x of ing){
  const qty=Number(x.count??x.quantity??x.amount??x.requiredCount),price=marketPrice(ingredientId(x));
  if(!isPositiveInt(qty)||price===null)return {status:"cost-pending",sale};
  cost+=qty*price;
 }
 if(sale===null||!yieldCount)return {status:"sale-pending",cost};
 const revenue=yieldCount*sale*0.95;
 return {status:"estimated",cost,revenue,profit:revenue-cost,sale};
}
function salePriceStatus(){
 const market=marketPrice(outputItemId(planned)),source=e("recipe-sale").dataset.source,channel=e("recipe-channel").value;
 e("recipe-use-market").disabled=market===null;
 if(channel==="npc"){
  e("recipe-price-note").textContent="Venta a NPC: introduce su precio real. Nunca se utiliza el precio de subasta como precio del vendedor.";
 }else if(source==="market"&&market!==null){
  e("recipe-price-note").textContent="Precio mínimo anunciado en subasta: "+gold(market)+" por unidad. Es una estimación, no una venta garantizada.";
 }else{
  e("recipe-price-note").textContent=market===null?
   "No hay precio de venta del producto en el mercado por ID. Introduce el precio real para calcular el beneficio.":
   "Precio de venta introducido manualmente. Mínimo anunciado actual: "+gold(market)+" por unidad.";
 }
}
function plan(r){
 planned=r;
 const root=e("recipe-plan");root.hidden=false;
 e("recipe-confirm-craft").disabled=!usable(r);
 e("recipe-plan-title").textContent="Fabricación: "+title(r);
 const raw=ingredients(r),out=r.product||r.output||r.createdItem||{};
 const knownYield=yieldPerCraft(r);
 e("recipe-batches").value="1";
 e("recipe-output-name").value=typeof out.name==="string"?out.name:typeof out.item?.name==="string"?out.item.name:"";
 e("recipe-output").value=knownYield??"";
 e("recipe-other").value="0";
 e("recipe-channel").value="ah";
 e("recipe-commission").value="5";
 const outputId=outputItemId(r),quotedPrice=marketPrice(outputId);
 e("recipe-sale").value=quotedPrice??"";
 e("recipe-sale").dataset.source=quotedPrice===null?"missing":"market";
 e("recipe-plan-info").textContent=raw.length?
  "Costes y beneficios por fabricación, usando los precios disponibles. Corrige cualquier importe que no coincida con el juego.":
  "La fuente no ofrece ingredientes verificables. No se puede calcular el beneficio.";
 const box=e("recipe-materials");box.replaceChildren();
 raw.forEach((x,i)=>{
  const id=x.itemId??x.item?.id??x.id,qty=x.count??x.quantity??x.amount??x.requiredCount;
  const row=document.createElement("div");row.className="recipe-ingredient";
  const heading=document.createElement("div");heading.className="recipe-ingredient-heading";
  const nameEl=document.createElement("strong");nameEl.id="recipe-ingredient-name-"+i;nameEl.textContent=ingredientName(x);
  const ref=document.createElement("small");ref.textContent=Number.isSafeInteger(Number(id))&&Number(id)>0?"ID "+id:"Identificador no disponible";
  heading.append(nameEl,ref);row.append(heading);
  const label=document.createElement("label");label.textContent="Cantidad";
  const q=document.createElement("input");q.type="number";q.min="1";q.step="1";q.id="recipe-qty-"+i;q.value=isPositiveInt(qty)?qty:"";q.placeholder="Cantidad pendiente";label.append(q);
  const price=document.createElement("label");const m=marketPrice(id);
  price.textContent="Precio por unidad (c)"+(m!=null?" · subasta":" · pendiente");
  const inp=document.createElement("input");inp.type="number";inp.min="0";inp.step="1";inp.id="recipe-price-"+i;inp.value=m==null?"":m;inp.placeholder="Precio desconocido";
  price.append(inp);row.append(label,price);box.append(row);
 });
 ["recipe-batches","recipe-output","recipe-other","recipe-commission"].forEach(id=>e(id).oninput=calc);
 box.querySelectorAll("input").forEach(input=>input.oninput=calc);
 e("recipe-sale").oninput=()=>{e("recipe-sale").dataset.source="manual";salePriceStatus();calc()};
 e("recipe-channel").onchange=()=>{
  if(e("recipe-channel").value==="npc"&&e("recipe-sale").dataset.source==="market"){
   e("recipe-sale").value="";e("recipe-sale").dataset.source="missing";
  }
  e("recipe-fee-wrap").hidden=e("recipe-channel").value==="npc";
  salePriceStatus();calc();
 };
 e("recipe-use-market").onclick=()=>{
  const market=marketPrice(outputItemId(planned));if(market===null)return;
  e("recipe-channel").value="ah";e("recipe-fee-wrap").hidden=false;
  e("recipe-sale").value=String(market);e("recipe-sale").dataset.source="market";
  salePriceStatus();calc();
 };
 e("recipe-fee-wrap").hidden=false;
 salePriceStatus();calc();root.scrollIntoView({behavior:"smooth",block:"start"});
}
function calc(){
 if(!planned)return;
 const raw=ingredients(planned),bValue=e("recipe-batches").value,yValue=e("recipe-output").value;
 const saleValue=e("recipe-sale").value,otherValue=e("recipe-other").value;
 const b=bValue===""?NaN:Number(bValue),y=yValue===""?NaN:Number(yValue);
 const sale=saleValue===""?null:Number(saleValue),other=otherValue===""?NaN:Number(otherValue);
 const channel=e("recipe-channel").value;
 const fee=channel==="ah"?Number(e("recipe-commission").value):0;
 let cost=0,missing=0,invalid=false;
 raw.forEach((x,i)=>{
  const q=e("recipe-qty-"+i).value,p=e("recipe-price-"+i).value;
  if(q===""||p===""){missing++;return}
  const a=Number(q),v=Number(p);
  if(!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(v)||v<0){invalid=true;return}
  cost+=a*v;
 });
 const msg=e("recipe-profit"),heading=e("recipe-profit-heading"),maxBox=e("recipe-maxbuy");
 maxBox.replaceChildren();
 const setResult=(headline,description,outcome="pending")=>{
  heading.textContent=headline;msg.textContent=description;
  heading.parentElement.dataset.outcome=outcome;
 };
 if(!raw.length){setResult("Beneficio pendiente","Faltan los ingredientes de esta receta.");return}
 if(invalid||!Number.isSafeInteger(b)||b<=0||!Number.isSafeInteger(y)||y<=0||
  !Number.isSafeInteger(other)||other<0||!Number.isFinite(fee)||fee<0||fee>100||
  (sale!==null&&(!Number.isSafeInteger(sale)||sale<0))){
  setResult("Datos incorrectos","Revisa las cantidades, el rendimiento y los precios: deben ser válidos.");
  return;
 }
 if(missing){
  setResult("Beneficio pendiente",missing+" ingrediente(s) sin cantidad o precio. No se considera coste cero un dato desconocido.");
  return;
 }
 const totalCost=b*(cost+other),costPerCraft=cost+other,netFactor=1-fee/100;
 const threshold=netFactor>0?Math.ceil(costPerCraft/(y*netFactor)):null;
 const channelName=channel==="ah"?"subasta":"NPC";
 const breakEven=threshold===null?"No existe precio rentable con comisión del 100%.":"Precio mínimo de venta para no perder: "+gold(threshold)+" por unidad.";
 if(sale===null){
  setResult("Beneficio pendiente","Coste por fabricación: "+gold(costPerCraft)+" · Coste del lote: "+gold(totalCost)+". "+breakEven+" Introduce el precio de venta "+channelName+" para calcular el beneficio.");
  return;
 }
 const gross=b*y*sale,commission=gross*(fee/100),netRevenue=gross-commission;
 const profit=netRevenue-totalCost,perCraft=profit/b;
 const margin=totalCost>0?(profit/totalCost*100).toFixed(1)+"%":"no calculable (coste 0)";
 const label=profit>0?"Beneficio potencial":profit<0?"Pérdida potencial":"Equilibrio";
 setResult(label+": "+gold(profit),
  "Coste del lote: "+gold(totalCost)+" ("+gold(costPerCraft)+"/fabricación) · Ingreso neto "+channelName+": "+gold(netRevenue)+
  " ("+gold(netRevenue/b)+"/fabricación) · Resultado por fabricación: "+gold(perCraft)+
  " · Rentabilidad sobre coste: "+margin+" · "+breakEven+
  (channel==="ah"?" Comisión estimada: "+gold(commission)+".":" Sin comisión de subasta.")+
  " Estimación, no registra ventas.",profit>0?"profit":profit<0?"loss":"even");
 const h=document.createElement("h4");h.textContent="Precio máximo de compra por ingrediente";maxBox.append(h);
 const note=document.createElement("small");
 note.textContent="Umbral por unidad manteniendo los precios de los demás ingredientes; si alguno falta, no se calcula. Para la subasta se incluye la comisión configurada.";
 maxBox.append(note);
 raw.forEach((x,i)=>{
  const qText=e("recipe-qty-"+i).value,q=qText===""?NaN:Number(qText),name=ingredientName(x);
  const p=document.createElement("p");
  const others=raw.some((_,j)=>j!==i&&(
   e("recipe-qty-"+j).value===""||e("recipe-price-"+j).value===""||
   !isPositiveInt(e("recipe-qty-"+j).value)||
   !Number.isSafeInteger(Number(e("recipe-price-"+j).value))||Number(e("recipe-price-"+j).value)<0));
  if(!Number.isSafeInteger(q)||q<=0||others){
   p.textContent=name+": pendiente (faltan cantidades o precios de otros materiales).";maxBox.append(p);return;
  }
  let othersCost=other;
  raw.forEach((_,j)=>{if(j!==i)othersCost+=Number(e("recipe-qty-"+j).value)*Number(e("recipe-price-"+j).value)});
  const ceiling=Math.floor((y*sale*netFactor-othersCost)/q);
  p.textContent=name+": "+(ceiling<0?"No rentable incluso a 0c (déficit de "+gold(-ceiling)+" por unidad)":gold(ceiling)+" máximo por unidad para no perder");
  maxBox.append(p);
 });
}

e("recipe-confirm-craft").onclick=()=>{
 if(!planned||!usable(planned)){alert("Receta incompleta o sin estructura verificable. No puede registrarse la fabricación.");return}
 const batches=e("recipe-batches").value===""?NaN:Number(e("recipe-batches").value),yieldCount=e("recipe-output").value===""?NaN:Number(e("recipe-output").value),outputName=e("recipe-output-name").value.trim();
 const ing=ingredients(planned);
 if(!ing.length||!Number.isSafeInteger(batches)||batches<=0||!Number.isSafeInteger(yieldCount)||yieldCount<=0||!outputName){alert("Faltan ingredientes, cantidades o producto. No se registrará nada.");return}
 const materials=[];
 for(let i=0;i<ing.length;i++){
  const x=ing[i],qty=e("recipe-qty-"+i).value===""?NaN:Number(e("recipe-qty-"+i).value),name=String(ingredientName(x)).trim();
  if(!Number.isSafeInteger(qty)||qty<=0||!name||name==="ID ?"){alert("Falta identificar un ingrediente o su cantidad.");return}
  materials.push({name,qty});
 }
 window.dispatchEvent(new CustomEvent("rockpeaks:craft",{detail:{materials,batches,output:{name:outputName,qty:yieldCount}}}));
};

e("recipe-load").onclick=async()=>{
 if(loading)return;loading=true;stop=false;records=[];visible=0;e("recipe-translation").textContent="Pendiente de cargar ingredientes…";prepareAudit();e("recipe-audit").disabled=true;e("recipe-share").disabled=true;e("recipe-copy").disabled=true;e("recipe-load").disabled=true;e("recipe-stop").disabled=false;e("recipe-status").textContent="Conectando con Warcraft Forever…";
 try{
  mod=mod||await import("https://warcraftforever.com/data/latest.mjs");
  if(!mod?.Recipes||typeof mod.Recipes.search!=="function")throw Error("La fuente no ofrece la interfaz de búsqueda esperada");
  let cursor=null,seen=new Set(),pages=0,unclassified=0,ids=new Set(),duplicates=0,spanish=0,fallback=0,unnamed=0,pinnedDataset=null;
  do{
   if(stop)break;
   const opts={locale:"esES",limit:100,includeUnknown:true};if(pinnedDataset)opts.dataset=pinnedDataset;if(cursor)opts.cursor=cursor;
   const result=await mod.Recipes.search("",opts);
   if(!Array.isArray(result.data))throw Error("La fuente no devolvió una lista de recetas");
   if(!result.dataset)throw Error("La fuente no identificó su versión de datos; no se continuará la paginación");
   if(pinnedDataset&&result.dataset!==pinnedDataset)throw Error("La versión de datos cambió durante la carga");
   pinnedDataset=result.dataset;
   if(result.data.length===0&&pages===0)throw Error("La fuente devolvió cero recetas; no puede validarse la cobertura");
   coverage=JSON.stringify(result.coverage||{}).slice(0,160);dataset=result.dataset||dataset;
   for(const r of result.data){if(!r||typeof r!=="object"||Array.isArray(r)){unclassified++;continue}const cat=category(r);if(cat){const k=String(r.id??r.spellId??"")+"|"+cat;if(k!=="|"+cat&&ids.has(k)){duplicates++;continue}if(k!=="|"+cat)ids.add(k);if(r.nameLocale==="esES")spanish++;else if(typeof r.name==="string"&&r.name.trim())fallback++;else unnamed++;records.push({...r,_prof:cat})}else unclassified++}
   pages++;e("recipe-status").textContent="Páginas: "+pages+" · recetas clasificadas: "+records.length+" · fuera del catálogo seleccionado: "+unclassified;
   render();
   const next=result.nextCursor||null;
   if(next&&seen.has(next))throw Error("Cursor repetido; catálogo incompleto");
   if(next)seen.add(next);
   cursor=next;
   if(pages>200)throw Error("Límite de seguridad alcanzado");
  }while(cursor);
  if(!stop)await translateIngredients();
  e("recipe-status").textContent=(stop?"Carga interrumpida; catálogo parcial.":"Lectura terminada, cobertura aún no verificada contra el juego.")+" "+records.length+" recetas clasificadas · "+records.filter(usable).length+" con estructura completa · "+spanish+" nombres esES · "+fallback+" nombres en otro idioma · "+unnamed+" sin nombre · "+unclassified+" fuera de las tres profesiones o sin clasificar · "+duplicates+" duplicadas omitidas. Versión fijada: "+pinnedDataset+" · Cobertura: "+(coverage||"no informada");
 }catch(err){e("recipe-status").textContent="Carga incompleta o fallida: "+err.message+". No se considerará un catálogo completo.";render()}
 finally{prepareAudit();loading=false;e("recipe-load").disabled=false;e("recipe-stop").disabled=true;e("recipe-audit").disabled=records.length===0;e("recipe-share").disabled=records.length===0;e("recipe-copy").disabled=records.length===0}
};
})();