import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const runtime={window:{}};
vm.runInNewContext(fs.readFileSync("scout-core.js","utf8"),runtime);
const scan=runtime.window.RockpeaksScoutCore.scan;
async function readJSON(url){
 let last;
 for(let i=0;i<3;i++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error("HTTP "+response.status+" "+url);
   return await response.json();
  }catch(e){last=e;if(i<2)await new Promise(resolve=>setTimeout(resolve,600*(i+1)))}
 }
 throw last;
}
const [catalog,snapshot]=await Promise.all([
 readJSON("https://auctionhouse.tk.gg/api/recipes"),
 readJSON("https://auctionhouse.tk.gg/api/m/eu-2-113")
]);
assert.ok(Array.isArray(catalog.recipes)&&Array.isArray(snapshot.items));
assert.ok(Array.isArray(snapshot.f));
const source=catalog.recipes.filter(r=>["Cooking","Alchemy","Leatherworking"].includes(r.prof));
assert.equal(source.length,920,"El catálogo actual ya no tiene 920 recetas");
const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
assert.equal(Object.keys(dictionary.recipes).length,920);
assert.equal(Object.keys(dictionary.items).length,1212);
const allItems=new Set(source.flatMap(r=>[r.item,...r.r.map(p=>p[0])]));
assert.equal(allItems.size,1212);
for(const id of allItems)assert.ok(dictionary.items[id],"Falta el producto/material "+id);
for(const recipe of source){
 assert.ok(dictionary.recipes[recipe.id],"Falta nombre de receta "+recipe.id);
 assert.ok(Number.isSafeInteger(recipe.qty)&&recipe.qty>0,"Cantidad de salida incorrecta "+recipe.id);
 assert.ok(Array.isArray(recipe.r)&&recipe.r.length>0,"Receta sin materiales "+recipe.id);
 for(const pair of recipe.r)assert.ok(Array.isArray(pair)&&pair.length===2&&pair.every(x=>Number.isSafeInteger(x)&&x>0),"Reactivo inválido "+recipe.id);
}
const counts={total:source.length,byProfession:Object.fromEntries(["Cooking","Alchemy","Leatherworking"].map(k=>[k,source.filter(r=>r.prof===k).length])),
 outputMultiples:source.filter(x=>x.qty>1).map(x=>({id:x.id,yield:x.qty,name:x.name})),
 snapshots:[],mathChecks:0};
for(const channel of ["npc","ah"]){
 const fee=5,depositCopper=120;
 const result=scan(catalog,snapshot,{channel,fee,depositCopper});
 assert.equal(result.stats.total,920);
 assert.equal(result.stats.total,result.stats.valid+result.stats.invalid+result.stats.missingMaterials+result.stats.missingSale);
 assert.equal(result.stats.valid,result.records.length);
 const marketRows=new Map(snapshot.items.map(x=>[x.id,x]));
 const fields=new Map(snapshot.f.map((n,i)=>[n,i]));
 const metric=(id,key)=>{const obj=marketRows.get(id),i=fields.get(key);return obj&&i!==undefined?obj.o?.[i]??null:null};
 for(const r of result.records){
  assert.ok(Number.isSafeInteger(r.cost)&&r.cost>0,"Coste inválido "+r.id);
  assert.ok(Number.isSafeInteger(r.revenue)&&r.revenue>=0);
  assert.ok(Number.isSafeInteger(r.profit));
  assert.ok(Number.isSafeInteger(r.unitSale)&&r.unitSale>0);
  assert.equal(r.revenue-r.cost,r.profit);
  assert.equal(r.cost,r.materials.reduce((sum,x)=>sum+x.unitPrice*x.count,0));
  const gross=r.yieldCount*r.unitSale;
  const expectedRevenue=channel==="npc"?gross:Math.floor(gross*.95);
  assert.equal(r.revenue,expectedRevenue,"El ingreso AH/NPC no cuadra con cobres enteros "+r.id);
  const expectedThreshold=Math.ceil(r.cost/(r.yieldCount*(1-fee/100)));
  if(channel==="ah"){
   assert.equal(r.breakEvenUnit,expectedThreshold);
   assert.equal(r.breakEvenAfterRelist,Math.ceil((r.cost+depositCopper)/(r.yieldCount*.95)));
   assert.equal(r.afterFailedListing,r.profit-depositCopper);
   assert.equal(r.downside10,Math.floor(Math.floor(gross*.9)*.95)-r.cost);
   assert.ok(!Number.isFinite(r.breakEvenUnit)||r.breakEvenUnit>0);
  }else{
   assert.equal(r.breakEvenUnit,null);
   assert.equal(r.breakEvenAfterRelist,null);
   assert.equal(r.afterFailedListing,null);
  }
  const source=channel==="npc"?catalog.items[r.productId]?.sell:metric(r.productId,"ask");
  if(source!=null&&source!=="")assert.equal(r.unitSale,source,"Quote source wrong "+r.id);
  counts.mathChecks++;
 }
 counts.snapshots.push({channel,fee,records:result.records.length,
  stats:result.stats,profitable:result.records.filter(x=>x.profit>0).length,
  unprofitable:result.records.filter(x=>x.profit<0).length,
  withProfitEstimate:result.records.length});
}
const fixture={
 recipes:[{id:9,prof:"Cooking",name:"Dos raciones de prueba",item:40,qty:2,r:[[20,2],[21,1]]}],
 items:{20:{name:"Ingrediente A"},21:{name:"Especia",buy:40},40:{name:"Comida",sell:120}},vendor:{21:40}
};
const book={t:0,f:["ask","vol24","sure24","listed"],items:[
 {id:20,o:[88,0,0,20]},
 {id:21,o:[null,0,0,0]},
 {id:40,o:[160,0,0,30]}
]};
const npc=scan(fixture,book,{channel:"npc",fee:5}).records[0];
assert.equal(npc.cost,216);
assert.equal(npc.revenue,240);
assert.equal(npc.profit,24);
assert.equal(npc.materials[1].source,"NPC");
const ah=scan(fixture,book,{channel:"ah",fee:5,depositCopper:120}).records[0];
assert.equal(ah.cost,216);assert.equal(ah.revenue,304);assert.equal(ah.profit,88);
assert.equal(ah.breakEvenUnit,114);
assert.equal(ah.breakEvenAfterRelist,177);
assert.equal(ah.afterFailedListing,-32);
const unknown={...book,items:book.items.filter(x=>x.id!==20)};
assert.equal(scan(fixture,unknown,{channel:"npc"}).records.length,0,"Material sin cotización no puede valer cero");
const entirelyUnknown={...book,items:book.items.filter(x=>x.id!==40)};
assert.equal(scan(fixture,entirelyUnknown,{channel:"ah"}).records.length,0,"Venta AH sin precio no es negocio validado");
const fee100=scan(fixture,book,{channel:"ah",fee:100}).records[0];
assert.equal(fee100.revenue,0);assert.equal(fee100.profit,-216);assert.equal(fee100.breakEvenUnit,null);
const risky={...fixture,recipes:[{...fixture.recipes[0],r:[[20,Number.MAX_SAFE_INTEGER],[21,1]]}]};
assert.equal(scan(risky,book,{channel:"npc"}).records.length,0,"Importes fuera de rango no pueden generar resultados");
console.log("ECONOMIC_AUDIT",JSON.stringify({date:"2026-11-22",...counts,
 fixture:{npc:{cost:npc.cost,revenue:npc.revenue,profit:npc.profit},
 ah:{cost:ah.cost,revenue:ah.revenue,profit:ah.profit,afterFailed:ah.afterFailedListing}},
 limitations:"Price snapshots measure posted quotes, not actual sale prices or stack depth; market costs assume enough listed units at the ask quote. In-game learned recipes and actual auction deposits are unverified."}));
