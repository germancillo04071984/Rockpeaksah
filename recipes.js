"use strict";
(async function(){
const root=document.createElement("section");root.className="card";root.innerHTML='<h2>📚 Catálogo de recetas de WoW Forever</h2><p class="muted">Cocina, alquimia y peletería. Datos del corpus público de profesiones; una receta en los archivos no garantiza que Rockpeaks pueda aprenderla. La cobertura y los nombres dependen de la fuente.</p><p><button id="recipe-load">Cargar catálogo completo disponible</button> <button id="recipe-stop" disabled>Detener</button></p><p id="recipe-status" aria-live="polite">Sin cargar</p><div class="row"><label>Profesión<select id="recipe-prof"><option value="all">Todas las tres</option><option value="cooking">Cocina</option><option value="alchemy">Alquimia</option><option value="leatherworking">Peletería</option></select></label><label>Buscar<input id="recipe-search" placeholder="Receta, ingrediente o ID"></label></div><p id="recipe-count"></p><div id="recipe-results"></div><div id="recipe-plan" class="card" hidden><h3 id="recipe-plan-title">Planificador</h3><p id="recipe-plan-info"></p><label>Fabricaciones <input id="recipe-batches" type="number" min="1" step="1" value="1"></label><div id="recipe-materials"></div><p><label>Raciones / unidades obtenidas por fabricación <input id="recipe-output" type="number" min="1" step="1" value="1"></label></p><div class="row"><label>Venta por unidad (cobres)<input id="recipe-sale" type="number" min="0" step="1" value="0"></label><label>Otros gastos por fabricación (cobres)<input id="recipe-other" type="number" min="0" step="1" value="0"></label></div><p><label>Comisión subasta (%) <input id="recipe-commission" type="number" min="0" max="100" step=".1" value="0"></label></p><p id="recipe-profit" aria-live="polite"></p><div id="recipe-maxbuy" aria-live="polite"></div><p><label>Nombre del producto fabricado <input id="recipe-output-name" placeholder="Confirma el nombre del producto"></label></p><button id="recipe-confirm-craft">Confirmar fabricación real y mover inventario</button><small>Los precios de materiales se introducen manualmente o se toman del mercado solo cuando coinciden los ID. Un ingrediente sin precio no equivale a coste cero.</small></div><p><button id="recipe-more" hidden>Mostrar más</button></p><small>El catálogo no modifica tu contabilidad ni inventario. Revisa cantidades y disponibilidad antes de fabricar. Los precios de mercado pueden faltar.</small>';
document.querySelector("main").append(root);
const e=id=>document.getElementById(id);
let records=[],visible=0,loading=false,stop=false,mod=null,coverage="",dataset="";
const isPositiveInt=x=>x!==null&&x!==undefined&&x!==""&&Number.isSafeInteger(Number(x))&&Number(x)>0;
const usable=r=>{const ing=ingredients(r),out=r.product||r.output||r.createdItem||{},yieldValue=out.count??out.quantity??r.outputCount;return ing.length>0&&ing.every(x=>x&&typeof x==="object"&&!Array.isArray(x)&&isPositiveInt(x.count??x.quantity??x.amount??x.requiredCount)&&(typeof(x.name||x.item?.name||x.itemName)==="string"||isPositiveInt(x.itemId??x.item?.id??x.id)))&&isPositiveInt(yieldValue)&&typeof(out.name||out.item?.name)==="string"};
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const category=r=>{const raw=[r.profession,r.professionName,r.skillLine,r.skillLineName,r.category,r.profession?.name,r.skill?.name,r.skill?.profession].filter(Boolean).map(v=>typeof v==="object"?JSON.stringify(v):String(v)).join(" ").toLowerCase();if(/leatherworking|peleter|cuero|leatherwork/.test(raw))return"leatherworking";if(/alchemy|alquimia/.test(raw))return"alchemy";if(/cooking|cocina/.test(raw))return"cooking";return null};
const title=r=>r.name||r.spellName||r.recipeName||r.product?.name||"Receta #"+(r.id??"?");
const arr=x=>Array.isArray(x)?x:[];
const ingredients=r=>arr(r.reagents||r.ingredients||r.materials||r.requiredItems);
function line(ing){return arr(ing).map(x=>{if(typeof x==="string")return x;const name=x.name||x.item?.name||x.itemName||("ID "+(x.itemId??x.id??"?"));const qty=x.count??x.quantity??x.amount??x.requiredCount;return (qty!=null?qty+" × ":"")+name}).join(" · ")}
function filtered(){const prof=e("recipe-prof").value,q=norm(e("recipe-search").value.trim());return records.filter(r=>(prof==="all"||r._prof===prof)&&(!q||norm([title(r),r.id,line(ingredients(r))].join(" ")).includes(q)))}
function render(reset=true){if(reset)visible=0;const matches=filtered();visible=Math.min(matches.length,visible+40);const out=e("recipe-results");out.replaceChildren();matches.slice(0,visible).forEach(r=>{const d=document.createElement("div");d.style.borderTop="1px solid #475569";d.style.padding="12px 0";const h=document.createElement("strong");h.textContent=title(r)+" · "+({cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería"}[r._prof]||"Sin clasificar");d.append(h);const p=document.createElement("p");p.className="muted";const ings=ingredients(r);p.textContent="ID "+(r.id??"sin identificar")+" · "+(ings.length?line(ings):"Ingredientes no disponibles en este registro");d.append(p);const output=r.product||r.output||r.createdItem;const o=document.createElement("small");o.textContent=output?"Producto: "+(output.name||output.item?.name||output.itemId||output.id||"sin nombre")+" · Cantidad: "+(output.count??output.quantity??r.outputCount??"no indicada"):"Producto/cantidad: no confirmados";d.append(o);const btn=document.createElement("button");btn.textContent=usable(r)?"Calcular fabricación":"Revisar receta incompleta";btn.onclick=()=>plan(r);d.append(document.createElement("p"),btn);out.append(d)});e("recipe-count").textContent=matches.length+" recetas coincidentes · "+records.length+" clasificadas · "+records.filter(usable).length+" con estructura completa (sin contrastar con el juego)";e("recipe-more").hidden=visible>=matches.length}
e("recipe-prof").onchange=()=>render();e("recipe-search").oninput=()=>render();e("recipe-more").onclick=()=>render(false);e("recipe-stop").onclick=()=>{stop=true;e("recipe-status").textContent="Deteniendo tras la página actual…"};

let planned=null;
const gold=n=>{if(!Number.isFinite(n))return "—";let v=Math.round(Math.abs(n)),sign=n<0?"−":"";return sign+[Math.floor(v/10000)?" "+Math.floor(v/10000)+"o":"",Math.floor(v%10000/100)?" "+Math.floor(v%10000/100)+"p":"",v%100+"c"].join(" ").trim()};
function marketPrice(id){if(id==null||typeof items==="undefined"||typeof val!=="function")return null;const it=items.find(x=>Number(x.id)===Number(id));if(!it)return null;const v=val(it,"ask");return v!=null&&Number.isFinite(Number(v))?Number(v):null}
function plan(r){
 planned=r;const root=e("recipe-plan");root.hidden=false;e("recipe-confirm-craft").disabled=!usable(r);e("recipe-plan-title").textContent="Fabricación: "+title(r);
 const raw=ingredients(r);const out=r.product||r.output||r.createdItem||{};
 const knownYield=out.count??out.quantity??r.outputCount;
 e("recipe-output-name").value=typeof out.name==="string"?out.name:"";
 e("recipe-output").value=knownYield!=null&&Number.isInteger(Number(knownYield))&&Number(knownYield)>0?knownYield:"";
 e("recipe-plan-info").textContent=raw.length?"Revisa ingredientes y cantidades. Los valores sin confirmar se marcarán como pendientes.":"La fuente no proporciona ingredientes verificables: cálculo bloqueado.";
 const box=e("recipe-materials");box.replaceChildren();
 raw.forEach((x,i)=>{
  const id=x.itemId??x.item?.id??x.id,qty=x.count??x.quantity??x.amount??x.requiredCount;
  const name=x.name||x.item?.name||x.itemName||("ID "+(id??"?"));
  const row=document.createElement("p");row.className="row";
  const label=document.createElement("label");label.textContent=name+" · unidades por fabricación";
  const q=document.createElement("input");q.type="number";q.min="1";q.step="1";q.id="recipe-qty-"+i;q.value=Number.isInteger(Number(qty))&&Number(qty)>0?qty:"";q.placeholder="Cantidad pendiente";label.append(q);
  const price=document.createElement("label");const m=marketPrice(id);price.textContent="Precio unitario en cobres"+(m!=null?" (mínimo anunciado)":" (pendiente)");
  const inp=document.createElement("input");inp.type="number";inp.min="0";inp.step="1";inp.id="recipe-price-"+i;inp.value=m==null?"":m;inp.placeholder="Precio desconocido";price.append(inp);row.append(label,price);box.append(row);
 });
 ["recipe-batches","recipe-output","recipe-sale","recipe-other","recipe-commission"].forEach(id=>e(id).oninput=calc);
 box.querySelectorAll("input").forEach(input=>input.oninput=calc);
 calc();root.scrollIntoView({behavior:"smooth",block:"start"});
}
function calc(){
 if(!planned)return;
 const raw=ingredients(planned),b=e("recipe-batches").value===""?NaN:Number(e("recipe-batches").value),y=e("recipe-output").value===""?NaN:Number(e("recipe-output").value),sale=Number(e("recipe-sale").value),other=Number(e("recipe-other").value),fee=Number(e("recipe-commission").value);
 let cost=0,missing=0,invalid=false;
 raw.forEach((x,i)=>{const q=e("recipe-qty-"+i).value,p=e("recipe-price-"+i).value;if(q===""||p===""){missing++;return}const a=Number(q),v=Number(p);if(!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(v)||v<0){invalid=true;return}cost+=a*v});
 const msg=e("recipe-profit"),maxBox=e("recipe-maxbuy");maxBox.replaceChildren();
 if(!raw.length){msg.textContent="Cálculo no disponible: faltan ingredientes de la receta.";return}
 if(invalid||!Number.isSafeInteger(b)||b<=0||!Number.isSafeInteger(y)||y<=0||!Number.isSafeInteger(sale)||sale<0||!Number.isSafeInteger(other)||other<0||!Number.isFinite(fee)||fee<0||fee>100){msg.textContent="Revisa cantidades y precios: deben ser válidos.";return}
 if(missing){msg.textContent="Pendiente: "+missing+" ingrediente(s) sin cantidad o precio. Coste y beneficio no calculables todavía.";}else{
 const totalCost=b*(cost+other),revenue=b*y*sale*(1-fee/100),profit=revenue-totalCost;
 msg.textContent="Coste materiales: "+gold(b*cost)+" · Coste total: "+gold(totalCost)+" · Ingreso neto estimado: "+gold(revenue)+" · Resultado: "+gold(profit)+" ("+(profit>0?"beneficio estimado":profit<0?"pérdida estimada":"equilibrio")+"). No registra una venta ni descuenta inventario.";
}
 const totalCost=b*(cost+other),revenue=b*y*sale*(1-fee/100),profit=revenue-totalCost;
 msg.textContent="Coste materiales: "+gold(b*cost)+" · Coste total: "+gold(totalCost)+" · Ingreso neto estimado: "+gold(revenue)+" · Resultado: "+gold(profit)+" ("+(profit>0?"beneficio estimado":profit<0?"pérdida estimada":"equilibrio")+"). No registra una venta ni descuenta inventario.";
 
 const heading=document.createElement("h4");heading.textContent="Precio máximo de compra por ingrediente";maxBox.append(heading);
 const note=document.createElement("small");note.textContent="Umbral de equilibrio por unidad, manteniendo los precios de los demás ingredientes. Un valor negativo significa que ni obteniéndolo gratis se evita la pérdida. Requiere conocer el precio de todos los demás materiales.";maxBox.append(note);
 raw.forEach((x,i)=>{
  const q=Number(e("recipe-qty-"+i).value),name=x.name||x.item?.name||x.itemName||("ID "+(x.itemId??x.id??"?"));
  const p=document.createElement("p");
  const others=raw.some((_,j)=>j!==i&&(e("recipe-qty-"+j).value===""||e("recipe-price-"+j).value===""));
  if(!Number.isSafeInteger(q)||q<=0||others){p.textContent=name+": pendiente (faltan cantidades o precios de otros materiales).";maxBox.append(p);return}
  let othersCost=other;
  raw.forEach((_,j)=>{if(j!==i)othersCost+=Number(e("recipe-qty-"+j).value)*Number(e("recipe-price-"+j).value)});
  const ceiling=Math.floor((y*sale*(1-fee/100)-othersCost)/q);
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
  const x=ing[i],qty=e("recipe-qty-"+i).value===""?NaN:Number(e("recipe-qty-"+i).value),name=String(x.name||x.item?.name||x.itemName||("ID "+(x.itemId??x.item?.id??x.id??"?"))).trim();
  if(!Number.isSafeInteger(qty)||qty<=0||!name||name==="ID ?"){alert("Falta identificar un ingrediente o su cantidad.");return}
  materials.push({name,qty});
 }
 window.dispatchEvent(new CustomEvent("rockpeaks:craft",{detail:{materials,batches,output:{name:outputName,qty:yieldCount}}}));
};

e("recipe-load").onclick=async()=>{
 if(loading)return;loading=true;stop=false;records=[];visible=0;e("recipe-load").disabled=true;e("recipe-stop").disabled=false;e("recipe-status").textContent="Conectando con Warcraft Forever…";
 try{
  mod=mod||await import("https://warcraftforever.com/data/latest.mjs");
  if(!mod?.Recipes||typeof mod.Recipes.search!=="function")throw Error("La fuente no ofrece la interfaz de búsqueda esperada");
  let cursor=null,seen=new Set(),pages=0,unclassified=0,ids=new Set(),duplicates=0;
  do{
   if(stop)break;
   const opts={locale:"esES",limit:100,includeUnknown:true};if(cursor)opts.cursor=cursor;
   const result=await mod.Recipes.search("",opts);
   if(!Array.isArray(result.data))throw Error("La fuente no devolvió una lista de recetas");
   if(result.data.length===0&&pages===0)throw Error("La fuente devolvió cero recetas; no puede validarse la cobertura");
   coverage=JSON.stringify(result.coverage||{}).slice(0,160);dataset=result.dataset||dataset;
   for(const r of result.data){if(!r||typeof r!=="object"||Array.isArray(r)){unclassified++;continue}const cat=category(r);if(cat){const k=String(r.id??r.spellId??"")+"|"+cat;if(k!=="|"+cat&&ids.has(k)){duplicates++;continue}if(k!=="|"+cat)ids.add(k);records.push({...r,_prof:cat})}else unclassified++}
   pages++;e("recipe-status").textContent="Páginas: "+pages+" · recetas clasificadas: "+records.length+" · pendientes de clasificar: "+unclassified;
   render();
   const next=result.nextCursor||null;
   if(next&&seen.has(next))throw Error("Cursor repetido; catálogo incompleto");
   if(next)seen.add(next);
   cursor=next;
   if(pages>200)throw Error("Límite de seguridad alcanzado");
  }while(cursor);
  e("recipe-status").textContent=(stop?"Carga interrumpida; catálogo parcial.":"Lectura terminada, cobertura aún no verificada contra el juego.")+" "+records.length+" recetas clasificadas · "+records.filter(usable).length+" con estructura completa · "+unclassified+" sin profesión identificable · "+duplicates+" duplicadas omitidas. Fuente: "+(dataset||"versión no indicada")+" · Cobertura: "+(coverage||"no informada");
 }catch(err){e("recipe-status").textContent="Carga incompleta o fallida: "+err.message+". No se considerará un catálogo completo.";render()}
 finally{loading=false;e("recipe-load").disabled=false;e("recipe-stop").disabled=true}
};
})();