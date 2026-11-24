import {shortlist,assess,netUnit} from "./radar.mjs?v=3";
export function initRadar(ctx){
 const $=id=>document.getElementById(id),el=(tag,t,c)=>{const x=document.createElement(tag);if(t!=null)x.textContent=t;if(c)x.className=c;return x};
 let rows=[],results=new Map(),running=false,stamp=null,generation=0;
 const budget=()=>{const v=$("radar-budget").value.trim();return v===""?null:Math.round(Number(v)*10000)};
 const money=v=>ctx.money(v===null||v===undefined?null:Math.round(v));
 const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 function metric(host,label,value,cls){const d=el("div",null,"rank-value");d.append(el("small",label),el("strong",value,cls));host.append(d)}
 function render(){
  const o=$("radar-results");o.replaceChildren();const q=norm($("radar-search").value.trim());
  const filtered=rows.filter(x=>!q||norm(ctx.name(x.id)).includes(q)||String(x.id)===q).sort((a,b)=>{const x=results.get(a.id),y=results.get(b.id);return (y?.state==="candidate"?1:0)-(x?.state==="candidate"?1:0)||(y?.score??-1)-(x?.score??-1)||b.priority-a.priority});
  $("radar-count").textContent=rows.length+" señales TSM · "+results.size+" históricos comprobados · "+[...results.values()].filter(x=>x.state==="candidate").length+" candidatos sin competencia inferior observada";
  if(!filtered.length)o.append(el("p","Sin señales con los filtros actuales."));
  for(const x of filtered.slice(0,50)){const r=results.get(x.id),card=el("article",null,"rank-card");card.dataset.channel="ah";card.append(el("h3",ctx.name(x.id)),el("small",r?r.state==="candidate"?"Candidato para revisar":r.state==="unknown"?"Datos incompletos":"En vigilancia":"Señal preliminar TSM · sin verificar"));
   const g=el("div",null,"rank-metrics");metric(g,"Mínimo anunciado",money(x.ask));metric(g,"Referencia TSM",money(x.reference));metric(g,"Margen orientativo TSM",(x.indicativeRoi*100).toFixed(1)+" %");metric(g,"Volumen 24 h estimado",x.estimatedSales??"—");
   if(r?.target){metric(g,"Objetivo histórico 7 días",money(r.target));metric(g,"Máximo de compra (20 %)",money(r.maxPrice));metric(g,"IOR provisional",r.score===null?"—":r.score+"/100 · cobertura "+r.coverage+" %");metric(g,"Inversión de lote simulado",r.quantity?money(r.cost):"—");metric(g,"Beneficio potencial",money(r.profit),r.profit>0?"green":"");metric(g,"Unidades simuladas",r.quantity);metric(g,"Beneficio si baja un 10 %",money(r.stress),r.stress<0?"red":"");metric(g,"Competencia inferior restante",r.residual)}
   card.append(g,el("small","TSM: "+new Date(x.referenceTime).toLocaleString("es-ES")));if(r){card.append(el("p",r.reason,r.state==="candidate"?"green":"orange"));if(r.hist)card.append(el("small","Histórico: "+r.hist.samples+" muestras · "+r.hist.days+" días. Lote limitado al 10 % del volumen estimado. IOR "+(r.components.recovery===null?"sin muestra suficiente de recuperación real":"incluye recuperación real")+"; no es probabilidad de venta."));if(r.rows?.length){const d=el("details");d.append(el("summary","Tramos del lote simulado"));for(const t of r.rows)d.append(el("p",t.quantity+" × "+money(t.price)));card.append(d)}}
   const b=el("button","Comprobar histórico y tramos");b.disabled=running;b.onclick=()=>verify([x]);const open=el("button","Abrir objeto");open.onclick=()=>ctx.open(x.id);const actions=el("div",null,"radar-actions");actions.append(b,open);card.append(actions);o.append(card)}
  if(filtered.length>50)o.append(el("p","Mostrando 50 resultados. Busca por nombre o ID para localizar los demás."));
  $("radar-budget").disabled=running;$("radar-scan").disabled=running;$("radar-verify").disabled=running||!rows.some(x=>!results.has(x.id));
 }
 async function scan(){
  if(running)return;const cap=budget();if(!Number.isSafeInteger(cap)||cap<=0){$("radar-status").textContent="Introduce un capital mayor que cero.";return}
  running=true;const token=++generation;$("radar-status").textContent="Consultando referencias TSM…";render();
  try{const t=await ctx.tsm();const data=ctx.data();if(token!==generation)return;if(!data||!t.size)throw Error("No hay datos de mercado o TSM");rows=shortlist(data,t,cap);results.clear();stamp=data.t;$("radar-status").textContent="Instantánea: "+new Date(stamp).toLocaleString("es-ES")+" · señales sin validar. Comprueba los históricos antes de comprar."}catch(e){rows=[];results.clear();$("radar-status").textContent="No se pudo analizar: "+e.message}finally{running=false;render()}
 }
 async function verify(list){
  if(running)return;const cap=budget(),data=ctx.data();if(!Number.isSafeInteger(cap)||cap<=0||data?.t!==stamp){$("radar-status").textContent="Capital o instantánea modificados. Vuelve a buscar señales.";return}
  running=true;const token=generation;render();let done=0;
  try{for(const x of list){$("radar-status").textContent="Comprobando "+(done+1)+"/"+list.length+" · "+ctx.name(x.id);try{const detail=await ctx.book(x.id);if(token!==generation||ctx.data()?.t!==stamp)return;results.set(x.id,assess(x,detail,data,cap,Date.now(),.2,ctx.recovery?.(x.id)??null))}catch(e){if(token!==generation)return;results.set(x.id,{state:"unknown",reason:"No se pudo cargar el detalle: "+e.message})}done++;render()}}finally{running=false;if(token===generation)$("radar-status").textContent="Comprobación terminada: "+done+" objetos. Referencias de precios, no ventas confirmadas.";render()}
 }
 $("radar-scan").onclick=scan;$("radar-verify").onclick=()=>verify(rows.filter(x=>!results.has(x.id)).slice(0,10));$("radar-search").oninput=render;$("radar-budget").oninput=()=>{generation++;rows=[];results.clear();stamp=null;$("radar-status").textContent="Capital actualizado. Vuelve a buscar señales.";render()};
 return {invalidate(){generation++;rows=[];results.clear();stamp=null;$("radar-status").textContent="Instantánea actualizada. Busca nuevas señales.";render()}};
}
