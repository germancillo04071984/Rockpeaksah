import {rankRecipes,filterRanking,PROF} from "./ranking.mjs?v=20261124-firstaid1";
export function initRanking(ctx){
 const $=id=>document.getElementById(id),el=(tag,t,c)=>{const x=document.createElement(tag);if(t!=null)x.textContent=t;if(c)x.className=c;return x};
 const key="rockpeaks-v2-rank-settings-v1",settings={levels:{},recipes:{},vendors:{}};let visible=20,analysis=null,timingStatus="Cargando tiempos…";
 try{const raw=JSON.parse(localStorage.getItem(key)||"{}");for(const k of ["levels","recipes","vendors"])if(raw[k]&&typeof raw[k]==="object"&&!Array.isArray(raw[k]))settings[k]=raw[k]}catch{}
 function save(){try{localStorage.setItem(key,JSON.stringify(settings))}catch{$("rank-profile-status").textContent="No se pudo guardar el perfil local."}}
 const integer=(x,min,max)=>x!==""&&Number.isSafeInteger(Number(x))&&Number(x)>=min&&Number(x)<=max?Number(x):null;
 for(const p of Object.keys(PROF)){const input=$("rank-"+p);input.value=settings.levels[p]??"";input.onchange=()=>{const n=integer(input.value,0,999);if(n===null)delete settings.levels[p];else settings.levels[p]=n;save();refresh()}}
 $("rank-spice").checked=settings.vendors[2692]===40;$("rank-spice").onchange=()=>{if($("rank-spice").checked)settings.vendors[2692]=40;else delete settings.vendors[2692];save();refresh()};
 for(const k of ["rank-prof","rank-channel","rank-known","rank-positive","rank-order"])$(k).onchange=()=>{visible=20;render()};$("rank-search").oninput=()=>{visible=20;render()};$("rank-more").onclick=()=>{visible+=20;render()};
 fetch("./craft-times.json?v=3").then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(t=>{if(!t.rows||typeof t.build!=="string")throw Error("Tabla inválida");settings.timings=t;timingStatus="Tiempos del cliente "+t.build;refresh()}).catch(()=>{timingStatus="Tiempos automáticos no disponibles; se pueden introducir manualmente.";refresh()});
 const label={learned:"Aprendida",unlearned:"No aprendida",low:"Nivel insuficiente",unknown:"Sin verificar"};
 const rn=r=>ctx.recipeName(r.recipe);
 const money=v=>ctx.money(v===null?null:Math.round(v));
 function add(p,k,v,c){const a=el("div",null,"rank-value");a.append(el("small",k),el("strong",v,c));p.append(a)}
 function edit(r,host){const details=el("details"),sum=el("summary","Datos de esta receta");details.append(sum);const saved=settings.recipes[r.recipe.id]||{},box=el("div",null,"rank-edit");
 const known=el("select");for(const [v,t] of [["unknown","Sin verificar"],["yes","Aprendida"],["no","No aprendida"]])known.add(new Option(t,v));known.value=saved.learned??"unknown";
 const req=el("input");req.type="number";req.min="1";req.max="999";req.placeholder="Desconocido";req.value=saved.required??"";
 const sec=el("input");sec.type="number";sec.min=".1";sec.max="604800";sec.step=".1";sec.placeholder=r.seconds!==null&&r.timeSource==="client"?String(r.seconds)+" s (automático)":"Sin datos";sec.value=saved.seconds??"";
 for(const [t,input] of [["Estado de aprendizaje",known],["Nivel requerido",req],["Segundos por fabricación",sec]]){const l=el("label",t);l.append(input);box.append(l)}
 const button=el("button","Guardar datos de receta");button.onclick=()=>{const required=integer(req.value,1,999),seconds=Number(sec.value);settings.recipes[r.recipe.id]={learned:known.value,required,seconds:sec.value!==""&&seconds>=.1&&seconds<=604800?seconds:null};save();refresh()};box.append(button);details.append(box);host.append(details)}
 function render(){const o=$("rank-results");o.replaceChildren();if(!analysis){$("rank-more").hidden=true;return}const rows=filterRanking(analysis.records,{prof:$("rank-prof").value,channel:$("rank-channel").value,availability:$("rank-known").value,positive:$("rank-positive").checked,order:$("rank-order").value,query:$("rank-search").value,name:rn});
 $("rank-count").textContent=rows.length+" resultados · "+analysis.stats.recipes+" recetas de las cuatro profesiones · "+analysis.stats.estimated+" evaluaciones con precio · "+analysis.records.filter(x=>x.profit!==null&&x.perHour!==null).length+" con beneficio/hora · "+analysis.stats.incomplete+" sin cálculo · "+analysis.stats.invalid+" registros inválidos";
 if(!rows.length)o.append(el("p","No hay coincidencias. Prueba a mostrar también pérdidas y datos incompletos."));
 for(const r of rows.slice(0,visible)){const card=el("article",null,"rank-card");card.dataset.channel=r.channel;const h=el("h3",rn(r));card.append(h,el("small",PROF[r.prof]+" · "+(r.channel==="npc"?"Venta NPC":"Venta subasta estimada")+" · "+label[r.availability]+" · Nivel requerido "+(r.required??"sin verificar")));
 const grid=el("div",null,"rank-metrics");
 add(grid,"Beneficio / fabricación",money(r.profit),r.profit===null?"":r.profit>=0?"green":"red");add(grid,"Beneficio / hora fabricando",money(r.perHour),r.perHour===null?"":r.perHour>=0?"green":"red");add(grid,"Coste estimado",money(r.cost));add(grid,"Rentabilidad",r.roi===null?"—":(r.roi*100).toFixed(1)+" %");card.append(grid);
 if(r.seconds===null)card.append(el("small","Tiempo no verificado para esta receta; puedes introducirlo manualmente."));else card.append(el("small",r.seconds+" s por ciclo · "+(r.timeSource==="manual"?"Tiempo manual":"Tiempo del cliente")+(r.cooldownSeconds?" · Incluye reutilización de "+r.cooldownSeconds+" s":"")+" · No incluye compra ni venta"));
 if(r.missing)card.append(el("p",r.missing,"orange"));
 if(r.channel==="ah")card.append(el("small","Ventas estimadas por fuente (24 h): "+(r.volume??"sin datos")+" · No es tiempo de venta ni demanda confirmada."));
 const details=el("details"),sum=el("summary","Ingredientes y coste estimado");details.append(sum);for(const m of r.lines)details.append(el("p",ctx.itemName(m.id)+" × "+m.count+" · "+money(m.unit)+(m.source?" ("+m.source+")":"")));card.append(details);
 const b=el("button","Abrir simulador con tramos reales");b.onclick=()=>ctx.open(r.recipe,r.channel,settings.vendors);card.append(b);edit(r,card);o.append(card)}
 $("rank-more").hidden=visible>=rows.length;
 }
 function refresh(){try{const d=ctx.data();analysis=rankRecipes(d.catalog,d.overview,settings);$("rank-status").textContent=(analysis.fresh?"Instantánea: ":"Datos antiguos: ")+new Date(analysis.t).toLocaleString("es-ES")+" · "+timingStatus+" · Estimación por mínimo anunciado, no garantiza el stock al mínimo.";render()}catch(e){analysis=null;$("rank-status").textContent=e.message;render()}}
 return {refresh};
}
