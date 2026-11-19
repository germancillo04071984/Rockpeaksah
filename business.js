"use strict";
(function(){
const key="rockpeaks-business-v1", fmt=n=>{n=Math.round(n||0);const sign=n<0?"−":"";n=Math.abs(n);return sign+[Math.floor(n/10000)?" "+Math.floor(n/10000)+"o":"",Math.floor(n%10000/100)?" "+Math.floor(n%10000/100)+"p":"",n%100+"c"].join(" ").trim()};
let db;try{db=JSON.parse(localStorage.getItem(key)||"{}")}catch{db={}};db.transactions=Array.isArray(db.transactions)?db.transactions:[];db.recipes=db.recipes||{};
const section=document.createElement("section");section.className="card";section.innerHTML='<h2>⚒ Centro de operaciones Rockpeaks</h2><p class="muted">Calculadora, inventario y contabilidad local. Los datos se guardan en este navegador; exporta una copia para no perderlos.</p><h3>Calculadora comercial</h3><p><label>Producto o receta <input id="biz-product" placeholder="Ej.: Tortilla con un sabor curioso"></label></p><div class="row"><label>Unidades producidas por fabricación<input id="biz-yield" type="number" min="1" value="1"></label><label>Materiales por fabricación (cobres)<input id="biz-cost" type="number" min="0" value="0"></label></div><div class="row"><label>Otros costes por fabricación (cobres)<input id="biz-extra" type="number" min="0" value="0"></label><label>Precio de venta por unidad (cobres)<input id="biz-sale" type="number" min="0" value="0"></label></div><p><label>Canal de venta <select id="biz-channel"><option value="npc">NPC (sin comisión)</option><option value="ah">Subasta (comisión configurable)</option></select></label> <label>Comisión de subasta (%) <input id="biz-fee" type="number" min="0" max="100" value="5"></label></p><p id="biz-result" aria-live="polite"></p><button id="biz-save-recipe">Guardar configuración</button> <button id="biz-market">Usar precio mínimo del objeto seleccionado</button><p><small id="biz-market-note">Precio orientativo, verifica cantidades y costes reales.</small></p><h3>Registrar operación</h3><div class="row"><label>Tipo<select id="biz-type"><option value="compra">Compra</option><option value="venta">Venta</option><option value="gasto">Gasto</option><option value="recoleccion">Recolección propia</option><option value="fabricacion">Fabricación</option></select></label><label>Cantidad<input id="biz-qty" type="number" min="1" value="1"></label></div><div class="row"><label>Precio total (cobres)<input id="biz-total" type="number" min="0" value="0"></label><label>Fecha<input id="biz-date" type="date"></label></div><p><button id="biz-add">Registrar</button> <button id="biz-export">Exportar copia JSON</button> <button id="biz-csv">Exportar CSV</button> <label>Restaurar JSON <input id="biz-import" type="file" accept=".json,application/json"></label></p><p id="biz-summary"></p><div id="biz-history"></div><small>El saldo representa movimientos registrados, no necesariamente el oro disponible en el personaje. La recolección propia se registra separada de las compras. No se deducen existencias sin datos suficientes.</small>';
document.querySelector("main").insertBefore(section,document.querySelector("main").lastElementChild);
const e=id=>document.getElementById(id),num=id=>Number(e(id).value)||0,save=()=>localStorage.setItem(key,JSON.stringify(db));
e("biz-date").value=new Date().toISOString().slice(0,10);
function calculate(){const y=Math.max(1,num("biz-yield")),cost=num("biz-cost")+num("biz-extra"),sale=num("biz-sale"),rate=e("biz-channel").value==="ah"?num("biz-fee")/100:0,net=sale*y*(1-rate)-cost,threshold=Math.ceil(cost/(y*(1-rate)||1));e("biz-result").textContent="Resultado por fabricación: "+fmt(net)+" · Precio mínimo de venta para no perder: "+fmt(threshold)+" por unidad · "+(net>0?"BENEFICIO":net<0?"PÉRDIDA":"EQUILIBRIO")+" (estimación; no incluye depósitos de subasta no recuperados)."}
["biz-yield","biz-cost","biz-extra","biz-sale","biz-channel","biz-fee"].forEach(id=>e(id).addEventListener("input",calculate));
e("biz-product").addEventListener("change",()=>{let r=db.recipes[e("biz-product").value];if(r){["yield","cost","extra","sale","channel","fee"].forEach(k=>e("biz-"+k).value=r[k]);calculate()}});
e("biz-save-recipe").onclick=()=>{let name=e("biz-product").value.trim();if(!name)return alert("Escribe el nombre del producto");db.recipes[name]={};["yield","cost","extra","sale","channel","fee"].forEach(k=>db.recipes[name][k]=e("biz-"+k).value);save();alert("Configuración guardada en este navegador")};
function render(){let tx=db.transactions,buy=tx.filter(x=>["compra","gasto"].includes(x.type)).reduce((a,x)=>a+x.total,0),sold=tx.filter(x=>x.type==="venta").reduce((a,x)=>a+x.total,0);e("biz-summary").textContent="Ventas registradas: "+fmt(sold)+" · Compras y gastos: "+fmt(buy)+" · Flujo neto registrado: "+fmt(sold-buy)+" · "+tx.length+" operaciones";let box=e("biz-history");box.replaceChildren();tx.slice(-30).reverse().forEach(x=>{let p=document.createElement("p");p.textContent=x.date+" · "+x.type+" · "+x.product+" · "+x.qty+" uds. · "+fmt(x.total)+" ";let b=document.createElement("button");b.textContent="Eliminar";b.onclick=()=>{if(confirm("¿Eliminar esta operación?")){db.transactions=db.transactions.filter(t=>t.id!==x.id);save();render()}};p.append(b);box.append(p)})}
e("biz-add").onclick=()=>{let product=e("biz-product").value.trim();if(!product)return alert("Indica un producto");let qty=num("biz-qty"),total=num("biz-total");if(qty<=0||total<0)return alert("Cantidad o importe no válido");db.transactions.push({id:Date.now()+"-"+Math.random(),date:e("biz-date").value,type:e("biz-type").value,product,qty,total});save();render()};
function download(name,type,data){let a=document.createElement("a"),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
e("biz-export").onclick=()=>download("rockpeaks-contabilidad.json","application/json",JSON.stringify(db,null,2));
e("biz-csv").onclick=()=>{let lines=[["fecha","tipo","producto","cantidad","total_cobres"],...db.transactions.map(x=>[x.date,x.type,x.product,x.qty,x.total])];download("rockpeaks-operaciones.csv","text/csv;charset=utf-8",lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n"))};

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
  db={transactions:incoming.transactions.filter(t=>t&&typeof t.product==="string"&&Number.isFinite(t.total)&&Number.isFinite(t.qty)&&typeof t.type==="string"),recipes:incoming.recipes};
  save();render();alert("Copia restaurada.");
 }catch(err){alert("No se pudo importar: "+err.message)}
 finally{event.target.value=""}
};
calculate();render();
})();