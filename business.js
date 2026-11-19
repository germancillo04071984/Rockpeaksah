"use strict";
(function(){
const key="rockpeaks-business-v1", fmt=n=>{n=Math.round(n||0);const sign=n<0?"−":"";n=Math.abs(n);return sign+[Math.floor(n/10000)?" "+Math.floor(n/10000)+"o":"",Math.floor(n%10000/100)?" "+Math.floor(n%10000/100)+"p":"",n%100+"c"].join(" ").trim()};
let db;try{db=JSON.parse(localStorage.getItem(key)||"{}")}catch{db={}};db.transactions=Array.isArray(db.transactions)?db.transactions:[];db.recipes=db.recipes||{};db.stock=Array.isArray(db.stock)?db.stock:[];
const section=document.createElement("section");section.className="card";section.innerHTML='<h2>⚒ Centro de operaciones Rockpeaks</h2><p class="muted">Calculadora, inventario y contabilidad local. Los datos se guardan en este navegador; exporta una copia para no perderlos.</p><h3>Calculadora comercial</h3><p><label>Producto o receta <input id="biz-product" list="biz-products" placeholder="Ej.: Tortilla con un sabor curioso"><datalist id="biz-products"></datalist></label></p><div class="row"><label>Unidades producidas por fabricación<input id="biz-yield" type="number" min="1" value="1"></label><label>Materiales por fabricación (cobres)<input id="biz-cost" type="number" min="0" value="0"></label></div><div class="row"><label>Otros costes por fabricación (cobres)<input id="biz-extra" type="number" min="0" value="0"></label><label>Precio de venta por unidad (cobres)<input id="biz-sale" type="number" min="0" value="0"></label></div><p><label>Canal de venta <select id="biz-channel"><option value="npc">NPC (sin comisión)</option><option value="ah">Subasta (comisión configurable)</option></select></label> <label>Comisión de subasta (%) <input id="biz-fee" type="number" min="0" max="100" value="5"></label></p><p id="biz-result" aria-live="polite"></p><button id="biz-save-recipe">Guardar configuración</button> <button id="biz-market">Usar precio mínimo del objeto seleccionado</button><p><small id="biz-market-note">Precio orientativo, verifica cantidades y costes reales.</small></p><h3>Inventario de materiales y productos</h3><p class="muted">Registra entradas y salidas reales. Las fabricaciones no descuentan materiales automáticamente hasta definir sus cantidades exactas.</p><p><label>Nombre del material o producto <input id="stock-name" placeholder="Ej.: Huevo de raptor"></label></p><div class="row"><label>Movimiento<select id="stock-kind"><option value="compra">Entrada comprada</option><option value="recoleccion">Entrada propia</option><option value="fabricacion">Entrada fabricada</option><option value="consumo">Salida por consumo</option><option value="venta">Salida por venta</option><option value="ajuste">Ajuste de inventario (+/-)</option></select></label><label>Unidades<input id="stock-qty" type="number" step="1" value="1"></label></div><p><button id="stock-add">Registrar movimiento</button></p><div id="stock-summary"></div><h4>Últimas fabricaciones confirmadas</h4><div id="craft-history"></div><h3>Registrar operación</h3><div class="row"><label>Tipo<select id="biz-type"><option value="compra">Compra</option><option value="venta">Venta</option><option value="gasto">Gasto</option><option value="recoleccion">Recolección propia</option><option value="fabricacion">Fabricación</option></select></label><label>Cantidad<input id="biz-qty" type="number" min="1" value="1"></label></div><div class="row"><label>Precio total (cobres)<input id="biz-total" type="number" min="0" value="0"></label><label>Fecha<input id="biz-date" type="date"></label></div><p><button id="biz-add">Registrar</button> <button id="biz-export">Exportar copia JSON</button> <button id="biz-csv">Exportar CSV</button> <button id="biz-share">Compartir CSV (iPhone)</button> <button id="biz-copy">Copiar CSV</button> <a id="biz-download" hidden download="rockpeaks-operaciones.csv">Guardar CSV</a> <label>Restaurar JSON <input id="biz-import" type="file" accept=".json,application/json"></label></p><p id="biz-export-status" role="status"></p><textarea id="biz-csv-text" readonly hidden aria-label="CSV de operaciones" rows="5" style="width:100%;box-sizing:border-box"></textarea><p id="biz-summary"></p><div id="biz-history"></div><small>El saldo representa movimientos registrados, no necesariamente el oro disponible en el personaje. La recolección propia se registra separada de las compras. No se deducen existencias sin datos suficientes.</small>';
document.getElementById("panel-business")?.append(section);
if(!section.isConnected)return;
const e=id=>document.getElementById(id),num=id=>Number(e(id).value)||0,save=()=>localStorage.setItem(key,JSON.stringify(db));
e("biz-date").value=new Date().toISOString().slice(0,10);
function calculate(){const y=Math.max(1,num("biz-yield")),cost=num("biz-cost")+num("biz-extra"),sale=num("biz-sale"),rate=e("biz-channel").value==="ah"?num("biz-fee")/100:0,net=sale*y*(1-rate)-cost,threshold=Math.ceil(cost/(y*(1-rate)||1));e("biz-result").textContent="Resultado por fabricación: "+fmt(net)+" · Precio mínimo de venta para no perder: "+fmt(threshold)+" por unidad · "+(net>0?"BENEFICIO":net<0?"PÉRDIDA":"EQUILIBRIO")+" (estimación; no incluye depósitos de subasta no recuperados)."}
["biz-yield","biz-cost","biz-extra","biz-sale","biz-channel","biz-fee"].forEach(id=>e(id).addEventListener("input",calculate));
e("biz-product").addEventListener("change",()=>{let r=db.recipes[e("biz-product").value];if(r){["yield","cost","extra","sale","channel","fee"].forEach(k=>e("biz-"+k).value=r[k]);calculate()}});
e("biz-save-recipe").onclick=()=>{let name=e("biz-product").value.trim();if(!name)return alert("Escribe el nombre del producto");db.recipes[name]={};["yield","cost","extra","sale","channel","fee"].forEach(k=>db.recipes[name][k]=e("biz-"+k).value);save();render();alert("Configuración guardada en este navegador")};
function render(){const dl=e("biz-products");dl.replaceChildren();Object.keys(db.recipes).sort((a,b)=>a.localeCompare(b,"es")).forEach(name=>{let o=document.createElement("option");o.value=name;dl.append(o)});renderStock();let tx=db.transactions,buy=tx.filter(x=>["compra","gasto"].includes(x.type)).reduce((a,x)=>a+x.total,0),sold=tx.filter(x=>x.type==="venta").reduce((a,x)=>a+x.total,0);e("biz-summary").textContent="Ventas registradas: "+fmt(sold)+" · Compras y gastos: "+fmt(buy)+" · Flujo neto registrado: "+fmt(sold-buy)+" · "+tx.length+" operaciones";let box=e("biz-history");box.replaceChildren();tx.slice(-30).reverse().forEach(x=>{let p=document.createElement("p");p.textContent=x.date+" · "+x.type+" · "+x.product+" · "+x.qty+" uds. · "+fmt(x.total)+" ";let b=document.createElement("button");b.textContent="Eliminar";b.onclick=()=>{if(confirm("¿Eliminar esta operación?")){db.transactions=db.transactions.filter(t=>t.id!==x.id);save();render()}};p.append(b);box.append(p)})}
e("biz-add").onclick=()=>{let product=e("biz-product").value.trim();if(!product)return alert("Indica un producto");let qty=num("biz-qty"),total=num("biz-total");if(qty<=0||total<0)return alert("Cantidad o importe no válido");db.transactions.push({id:Date.now()+"-"+Math.random(),date:e("biz-date").value,type:e("biz-type").value,product,qty,total});save();render()};
function download(name,type,data){let a=document.createElement("a"),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
e("biz-export").onclick=()=>download("rockpeaks-contabilidad.json","application/json",JSON.stringify(db,null,2));
const bizCsvName="rockpeaks-operaciones.csv";
let bizCsvUrl="",bizCsvText="";
const bizCsvCell=x=>{let v=String(x??"");if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'};
function prepareBizCsv(){
 const rows=[["fecha","tipo","producto","cantidad","total_cobres"],...db.transactions.map(x=>[x.date,x.type,x.product,x.qty,x.total])];
 bizCsvText="\uFEFF"+rows.map(row=>row.map(bizCsvCell).join(",")).join("\r\n");
 const link=e("biz-download");if(bizCsvUrl)URL.revokeObjectURL(bizCsvUrl);
 bizCsvUrl=URL.createObjectURL(new Blob([bizCsvText],{type:"text/csv;charset=utf-8"}));
 link.href=bizCsvUrl;link.hidden=false;
 return new Blob([bizCsvText],{type:"text/csv;charset=utf-8"});
}
e("biz-csv").onclick=()=>{prepareBizCsv();e("biz-download").click();e("biz-export-status").textContent="Descarga solicitada. Si no aparece en iPhone, utiliza «Compartir CSV» o «Guardar CSV»."};
e("biz-share").onclick=async()=>{
 const blob=prepareBizCsv();
 try{
  if(typeof File==="function"&&navigator.share){
   const file=new File([blob],bizCsvName,{type:"text/csv"});
   if(!navigator.canShare||navigator.canShare({files:[file]})){
    await navigator.share({files:[file]});e("biz-export-status").textContent="CSV enviado al menú Compartir.";return;
   }
  }
  e("biz-export-status").textContent="Compartir archivos no disponible. Usa «Guardar CSV» o «Copiar CSV».";
 }catch(err){e("biz-export-status").textContent=err?.name==="AbortError"?"Compartir cancelado.":"No se pudo compartir. Prueba «Guardar CSV» o «Copiar CSV»."}
};
e("biz-copy").onclick=async()=>{
 prepareBizCsv();
 try{await navigator.clipboard.writeText(bizCsvText);e("biz-export-status").textContent="CSV copiado."}
 catch{const t=e("biz-csv-text");t.value=bizCsvText;t.hidden=false;t.focus();t.select();e("biz-export-status").textContent="Selecciona «Copiar» en el texto o utiliza «Guardar CSV»."}
};

e("biz-market").onclick=()=>{
 const it=typeof selected!=="undefined"?selected:null;
 if(!it){e("biz-market-note").textContent="Selecciona primero un objeto.";return}
 const price=typeof val==="function"?val(it,"ask"):null;
 if(price==null||!Number.isFinite(Number(price))){e("biz-market-note").textContent="No hay precio mínimo disponible.";return}
 e("biz-product").value=typeof displayName==="function"?displayName(it):it.name;
 e("biz-cost").value=Number(price);
 e("biz-market-note").textContent="Precio mínimo anunciado: "+fmt(price)+" por unidad. Ajusta la cantidad y los demás materiales de la receta.";
 calculate();
};
e("biz-import").onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>2000000)throw Error("Archivo demasiado grande");
  const incoming=JSON.parse(await file.text());
  if(!incoming||!Array.isArray(incoming.transactions)||!incoming.recipes||typeof incoming.recipes!=="object"||Array.isArray(incoming.recipes))throw Error("Formato de copia no reconocido");
  if(!confirm("¿Sustituir la contabilidad local por esta copia? Exporta antes tus datos actuales."))return;
  db={stock:Array.isArray(incoming.stock)?incoming.stock.filter(x=>x&&typeof x.name==="string"&&Number.isInteger(x.qty)&&typeof x.kind==="string"):[],transactions:incoming.transactions.filter(t=>t&&typeof t.product==="string"&&Number.isFinite(t.total)&&Number.isFinite(t.qty)&&typeof t.type==="string"),recipes:incoming.recipes};
  save();render();alert("Copia restaurada.");
 }catch(err){alert("No se pudo importar: "+err.message)}
 finally{event.target.value=""}
};


function renderCraftHistory(){
 const out=e("craft-history");out.replaceChildren();
 const groups=new Map();
 for(const m of db.stock){if(!m.batchId)continue;if(!groups.has(m.batchId))groups.set(m.batchId,[]);groups.get(m.batchId).push(m)}
 const recent=[...groups.entries()].slice(-12).reverse();
 if(!recent.length){out.textContent="Todavía no hay fabricaciones confirmadas.";return}
 for(const [batchId,entries] of recent){
  const p=document.createElement("p"),made=entries.find(x=>x.kind==="fabricacion");
  p.textContent=(made?.date||"Sin fecha")+" · "+(made?.qty||"?")+" × "+(made?.name||"Producto sin identificar")+" ";
  const undo=document.createElement("button");undo.textContent="Deshacer lote";
  undo.onclick=()=>{
   const signs={compra:1,recoleccion:1,fabricacion:1,consumo:-1,venta:-1,ajuste:1},balances=new Map();
   for(const m of db.stock)balances.set(m.name,(balances.get(m.name)||0)+(signs[m.kind]||0)*m.qty);
   const outputs=new Map();
   for(const m of entries)if(m.kind==="fabricacion")outputs.set(m.name,(outputs.get(m.name)||0)+m.qty);
   const insufficient=[...outputs].filter(([name,qty])=>(balances.get(name)||0)<qty);
   if(insufficient.length)return alert("No puede deshacerse: ya se han consumido o vendido productos de este lote. Revisa el inventario.");
   if(!confirm("¿Deshacer esta fabricación y devolver todos sus materiales? Esta acción no modifica ventas ni movimientos contables."))return;
   const previous=db.stock;db.stock=previous.filter(x=>x.batchId!==batchId);
   try{save();render()}catch(err){db.stock=previous;alert("No se pudo deshacer: "+err.message)}
  };
  p.append(undo);out.append(p)
 }
}

function renderStock(){
 renderCraftHistory();
 const balances=new Map(),kinds={compra:1,recoleccion:1,fabricacion:1,consumo:-1,venta:-1,ajuste:1};
 db.stock.forEach(m=>{const sign=kinds[m.kind];if(!sign)return;balances.set(m.name,(balances.get(m.name)||0)+sign*m.qty)});
 const out=e("stock-summary");out.replaceChildren();
 if(!balances.size){out.textContent="No hay movimientos de inventario registrados.";return}
 const table=document.createElement("table");table.style.width="100%";
 const head=document.createElement("tr");["Material / producto","Unidades"].forEach(t=>{let th=document.createElement("th");th.textContent=t;head.append(th)});table.append(head);
 [...balances.entries()].sort((a,b)=>a[0].localeCompare(b[0],"es")).forEach(([name,qty])=>{let tr=document.createElement("tr");[name,String(qty)].forEach(t=>{let td=document.createElement("td");td.textContent=t;td.style.padding="6px";tr.append(td)});table.append(tr)});
 out.append(table);
 const p=document.createElement("p");p.className="muted";p.textContent="Saldo calculado solo desde movimientos registrados. Un saldo negativo indica movimientos incompletos o errores de registro.";out.append(p);
}
e("stock-add").onclick=()=>{
 const name=e("stock-name").value.trim(),kind=e("stock-kind").value,qty=Number(e("stock-qty").value);
 if(!name||name.length>150||!Number.isSafeInteger(qty)||qty===0||qty<0&&kind!=="ajuste"){alert("Introduce un material y una cantidad entera válida.");return}
 db.stock.push({id:Date.now()+"-"+Math.random(),date:new Date().toLocaleDateString("sv-SE"),name,kind,qty});
 save();render();
};

window.addEventListener("rockpeaks:craft",event=>{
 const d=event.detail||{},materials=d.materials,output=d.output,batches=d.batches;
 if(!Array.isArray(materials)||!materials.length||!output||!Number.isSafeInteger(batches)||batches<=0)return alert("Fabricación inválida.");
 if(!materials.every(m=>typeof m.name==="string"&&m.name.trim()&&Number.isSafeInteger(m.qty)&&m.qty>0))return alert("Hay ingredientes incompletos.");
 if(typeof output.name!=="string"||!output.name.trim()||!Number.isSafeInteger(output.qty)||output.qty<=0)return alert("Falta el producto fabricado o su cantidad.");
 const sign={compra:1,recoleccion:1,fabricacion:1,consumo:-1,venta:-1,ajuste:1};
 const balances=new Map();
 db.stock.forEach(x=>balances.set(x.name,(balances.get(x.name)||0)+(sign[x.kind]||0)*x.qty));
 const needs=new Map();
 for(const m of materials){const amount=m.qty*batches;if(!Number.isSafeInteger(amount)||amount<=0)return alert("Cantidad total fuera de rango.");needs.set(m.name,(needs.get(m.name)||0)+amount)}
 if(![...needs.values()].every(Number.isSafeInteger)||!Number.isSafeInteger(output.qty*batches))return alert("Cantidad total fuera de rango.");
 const shortages=[...needs].filter(([name,qty])=>(balances.get(name)||0)<qty);
 if(shortages.length){alert("Inventario insuficiente o no registrado: "+shortages.map(([n,q])=>n+" (necesitas "+q+", constan "+(balances.get(n)||0)+")").join("; "));return}
 const desc=[...needs].map(([n,q])=>q+" × "+n).join("; ");
 if(!confirm("¿Confirmas fabricación REAL de "+(output.qty*batches)+" × "+output.name+" consumiendo "+desc+"? No se registrará ninguna venta."))return;
 const stamp=new Date().toISOString(),batchId="craft-"+stamp+"-"+Math.random().toString(36).slice(2);
 const entries=[...[...needs].map(([name,qty])=>({id:batchId+"-"+Math.random(),batchId,date:stamp.slice(0,10),name,kind:"consumo",qty})),{id:batchId+"-output",batchId,date:stamp.slice(0,10),name:output.name,kind:"fabricacion",qty:output.qty*batches}];
 db.stock.push(...entries);
 try{save();render();alert("Fabricación registrada en inventario. No se ha registrado una venta ni un beneficio.")}catch(err){db.stock.splice(-entries.length);alert("No se pudo guardar: "+err.message)}
});

calculate();render();
})();