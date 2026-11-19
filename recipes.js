"use strict";
(async function(){
const root=document.createElement("section");root.className="card";root.innerHTML='<h2>📚 Catálogo de recetas de WoW Forever</h2><p class="muted">Cocina, alquimia y peletería. Datos del corpus público de profesiones; una receta en los archivos no garantiza que Rockpeaks pueda aprenderla. La cobertura y los nombres dependen de la fuente.</p><p><button id="recipe-load">Cargar catálogo completo disponible</button> <button id="recipe-stop" disabled>Detener</button></p><p id="recipe-status" aria-live="polite">Sin cargar</p><div class="row"><label>Profesión<select id="recipe-prof"><option value="all">Todas las tres</option><option value="cooking">Cocina</option><option value="alchemy">Alquimia</option><option value="leatherworking">Peletería</option></select></label><label>Buscar<input id="recipe-search" placeholder="Receta, ingrediente o ID"></label></div><p id="recipe-count"></p><div id="recipe-results"></div><p><button id="recipe-more" hidden>Mostrar más</button></p><small>El catálogo no modifica tu contabilidad ni inventario. Revisa cantidades y disponibilidad antes de fabricar. Los precios de mercado pueden faltar.</small>';
document.querySelector("main").append(root);
const e=id=>document.getElementById(id);
let records=[],visible=0,loading=false,stop=false,mod=null,coverage="",dataset="";
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const category=r=>{const raw=[r.profession,r.professionName,r.skillLine,r.skillLineName,r.category,r.profession?.name,r.skill?.name,r.skill?.profession].filter(Boolean).map(v=>typeof v==="object"?JSON.stringify(v):String(v)).join(" ").toLowerCase();if(/leatherworking|peleter|cuero|leatherwork/.test(raw))return"leatherworking";if(/alchemy|alquimia/.test(raw))return"alchemy";if(/cooking|cocina/.test(raw))return"cooking";return null};
const title=r=>r.name||r.spellName||r.recipeName||r.product?.name||"Receta #"+(r.id??"?");
const arr=x=>Array.isArray(x)?x:[];
const ingredients=r=>arr(r.reagents||r.ingredients||r.materials||r.requiredItems);
function line(ing){return arr(ing).map(x=>{if(typeof x==="string")return x;const name=x.name||x.item?.name||x.itemName||("ID "+(x.itemId??x.id??"?"));const qty=x.count??x.quantity??x.amount??x.requiredCount;return (qty!=null?qty+" × ":"")+name}).join(" · ")}
function filtered(){const prof=e("recipe-prof").value,q=norm(e("recipe-search").value.trim());return records.filter(r=>(prof==="all"||r._prof===prof)&&(!q||norm([title(r),r.id,line(ingredients(r))].join(" ")).includes(q)))}
function render(reset=true){if(reset)visible=0;const matches=filtered();visible=Math.min(matches.length,visible+40);const out=e("recipe-results");out.replaceChildren();matches.slice(0,visible).forEach(r=>{const d=document.createElement("div");d.style.borderTop="1px solid #475569";d.style.padding="12px 0";const h=document.createElement("strong");h.textContent=title(r)+" · "+({cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería"}[r._prof]||"Sin clasificar");d.append(h);const p=document.createElement("p");p.className="muted";const ings=ingredients(r);p.textContent="ID "+(r.id??"sin identificar")+" · "+(ings.length?line(ings):"Ingredientes no disponibles en este registro");d.append(p);const output=r.product||r.output||r.createdItem;const o=document.createElement("small");o.textContent=output?"Producto: "+(output.name||output.item?.name||output.itemId||output.id||"sin nombre")+" · Cantidad: "+(output.count??output.quantity??r.outputCount??"no indicada"):"Producto/cantidad: no confirmados";d.append(o);out.append(d)});e("recipe-count").textContent=matches.length+" recetas coincidentes · "+records.length+" clasificadas en las tres profesiones";e("recipe-more").hidden=visible>=matches.length}
e("recipe-prof").onchange=()=>render();e("recipe-search").oninput=()=>render();e("recipe-more").onclick=()=>render(false);e("recipe-stop").onclick=()=>{stop=true;e("recipe-status").textContent="Deteniendo tras la página actual…"};
e("recipe-load").onclick=async()=>{
 if(loading)return;loading=true;stop=false;records=[];visible=0;e("recipe-load").disabled=true;e("recipe-stop").disabled=false;e("recipe-status").textContent="Conectando con Warcraft Forever…";
 try{
  mod=mod||await import("https://warcraftforever.com/data/latest.mjs");
  let cursor=null,seen=new Set(),pages=0,unclassified=0;
  do{
   if(stop)break;
   const opts={locale:"esES",limit:100,includeUnknown:true};if(cursor)opts.cursor=cursor;
   const result=await mod.Recipes.search("",opts);
   if(!Array.isArray(result.data))throw Error("La fuente no devolvió una lista de recetas");
   coverage=JSON.stringify(result.coverage||{}).slice(0,160);dataset=result.dataset||dataset;
   for(const r of result.data){const cat=category(r);if(cat)records.push({...r,_prof:cat});else unclassified++}
   pages++;e("recipe-status").textContent="Páginas: "+pages+" · recetas clasificadas: "+records.length+" · pendientes de clasificar: "+unclassified;
   render();
   const next=result.nextCursor||null;
   if(next&&seen.has(next))throw Error("Cursor repetido; catálogo incompleto");
   if(next)seen.add(next);
   cursor=next;
   if(pages>200)throw Error("Límite de seguridad alcanzado");
  }while(cursor);
  e("recipe-status").textContent=(stop?"Carga interrumpida; catálogo parcial.":"Lectura terminada.")+" "+records.length+" recetas clasificadas · "+unclassified+" sin profesión identificable. Fuente: "+(dataset||"versión actual")+" · Cobertura: "+(coverage||"no informada");
 }catch(err){e("recipe-status").textContent="Carga incompleta o fallida: "+err.message+". No se considerará un catálogo completo.";render()}
 finally{loading=false;e("recipe-load").disabled=false;e("recipe-stop").disabled=true}
};
})();