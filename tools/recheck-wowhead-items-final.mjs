import assert from "node:assert/strict";
import fs from "node:fs";

const source=JSON.parse(fs.readFileSync("locales/wowhead-checked-items-final.json","utf8"));
const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const recipes=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8"));
assert.equal(source.schema,1);
assert.equal(source.entries.length,52,"El lote final debe tener 52 artículos.");
assert.equal(new Set(source.entries.map(x=>x.id)).size,52,"Hay ID de objeto repetidos.");
assert.equal(source.entries.filter(x=>x.method==="id-and-market-english").length,49);
assert.equal(Object.keys(dictionary.items).length,1212);
assert.equal(dictionary.source.coverage.translatedItems,1212);
assert.equal(Object.keys(dictionary.recipes).length,920);
assert.ok(dictionary.source.updates.some(x=>x.batch===source.batch&&x.itemsAdded===52&&x.ids.length===52));
const marketResponse=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
assert.ok(marketResponse.ok,"Catálogo actual no disponible.");
const market=await marketResponse.json();
const currentRecipes=new Map(market.recipes.map(x=>[x.id,x]));
const used=new Map();
for(const r of market.recipes.filter(x=>["Cooking","Alchemy","Leatherworking"].includes(x.prof))){
 for(const [id,role] of [[r.item,"product"],...(r.r||[]).map(m=>[m[0],"material"])]){
  const entry=used.get(id)||{roles:new Set(),count:0};
  entry.roles.add(role);entry.count++;used.set(id,entry);
 }
}
async function getItem(id,edition,locale){
 const url="https://nether.wowhead.com/"+edition+"/tooltip/item/"+id+"?locale="+locale;
 let error;
 for(let i=0;i<3;i++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("HTTP "+response.status);
   return await response.json();
  }catch(e){error=e;if(i<2)await new Promise(resolve=>setTimeout(resolve,650*(i+1)))}
 }
 throw Error("No se pudo comprobar "+url+": "+String(error));
}
let verified=0,idx=0;
async function worker(){
 while(idx<source.entries.length){
  const entry=source.entries[idx++];
  const usage=used.get(entry.id);
  assert.ok(usage,"ID que ya no aparece en las recetas "+entry.id);
  assert.equal(usage.count,entry.recipeReferences,"Cambiaron las referencias a "+entry.id);
  assert.deepEqual([...usage.roles].sort(),entry.roles.slice().sort(),"Cambiaron usos del objeto "+entry.id);
  assert.equal(dictionary.items[entry.id],entry.es,"La traducción guardada difiere: "+entry.id);
  assert.equal(entry.spanishSource,"https://nether.wowhead.com/"+entry.edition+"/tooltip/item/"+entry.id+"?locale=6");
  assert.equal(entry.englishSource,"https://nether.wowhead.com/"+entry.edition+"/tooltip/item/"+entry.id+"?locale=0");
  const [es,en]=await Promise.all([getItem(entry.id,entry.edition,6),getItem(entry.id,entry.edition,0)]);
  assert.equal(es.name,entry.es,"Nombre de Wowhead ES distinto "+entry.id);
  assert.equal(en.name,entry.en,"Nombre de Wowhead EN distinto "+entry.id);
  const named=market.items?.[entry.id]?.name;
  if(entry.method==="id-and-market-english"){
   assert.equal(named,entry.en,"El mercado ha cambiado su nombre inglés "+entry.id);
   assert.notEqual(entry.en,entry.es,"Falta la traducción "+entry.id);
  }else if(entry.method==="same-in-both-locales"){
   assert.equal(entry.id,1529);
   assert.equal(named,entry.en);
   assert.equal(es.name,en.name);
   assert.equal(entry.es,"Jade");
  }else if(entry.method==="market-placeholder-and-wowhead-crafting"){
   assert.equal(entry.id,227855);
   assert.equal(named,"Item 227855");
   const production=currentRecipes.get(entry.recipeId);
   const crafted=recipes.entries.find(x=>x.id===entry.recipeId);
   assert.ok(production&&crafted,"Falta receta de disfraz sintético");
   assert.equal(production.item,entry.id);
   assert.equal(crafted.item,entry.id);
   assert.equal(crafted.wowheadSpell,entry.wowheadSpell);
   assert.equal(crafted.name,entry.es);
  }else if(entry.method==="market-placeholder-and-forever-item-id"){
   assert.equal(entry.id,252948);
   assert.equal(named,"Item 252948");
   assert.equal(entry.edition,"forever");
   assert.equal(entry.es,"Brotevil purificado");
  }else throw Error("Tipo de traducción desconocido "+entry.method);
  verified++;
 }
}
await Promise.all(Array.from({length:8},worker()));
assert.equal(verified,52);
console.log("VERIFIED_WOWHEAD_FINAL_ITEMS_52",JSON.stringify({verified,translated:Object.keys(dictionary.items).length,recipes:Object.keys(dictionary.recipes).length,exceptions:source.entries.filter(x=>x.method!=="id-and-market-english").map(x=>({id:x.id,method:x.method,name:x.es}))}));
