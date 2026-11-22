import assert from "node:assert/strict";
import fs from "node:fs";

const src=JSON.parse(fs.readFileSync("locales/wowhead-checked-items.json","utf8"));
const dict=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
assert.equal(src.schema,1);
assert.equal(src.entries.length,52,"Exactly 52 names should belong to the first item translation batch");
assert.equal(new Set(src.entries.map(r=>r.id)).size,52,"Duplicated item IDs in Wowhead provenance");
assert.equal(dict.source.coverage.translatedItems,1160);
assert.equal(Object.keys(dict.items).length,1160);
assert.equal(Object.keys(dict.recipes).length,920);
const feed=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
assert.ok(feed.ok,"Market recipe dataset unreachable");
const market=await feed.json();
const used=new Map();
for(const r of market.recipes.filter(x=>["Cooking","Alchemy","Leatherworking"].includes(x.prof))){
 for(const [id,role] of [[r.item,"product"],...(r.r||[]).map(pair=>[pair[0],"material"])]) {
  const data=used.get(id)||{roles:new Set(),references:0};
  data.roles.add(role);
  data.references++;
  used.set(id,data);
 }
}
async function tooltip(entry,locale) {
 const uri="https://nether.wowhead.com/"+entry.edition+"/tooltip/item/"+entry.id+"?locale="+locale;
 let error;
 for(let retry=0;retry<3;retry++){
  try{
   const res=await fetch(uri,{signal:AbortSignal.timeout(12000)});
   if(res.status===429||res.status>=500)throw Error("temporary HTTP "+res.status);
   if(!res.ok)throw Error("HTTP "+res.status);
   return await res.json();
  }catch(err){error=err;if(retry<2)await new Promise(resolve=>setTimeout(resolve,(retry+1)*700))}
 }
 throw new Error("Wowhead "+uri+": "+String(error));
}
let index=0,ok=0;
async function worker(){
 while(index<src.entries.length){
  const entry=src.entries[index++];
  assert.equal(dict.items[entry.id],entry.es,"Spanish name differs from published dictionary "+entry.id);
  assert.equal(market.items?.[entry.id]?.name,entry.en,"Market English item name changed "+entry.id);
  const usage=used.get(entry.id);
  assert.ok(usage,"Item not used by any current recipe: "+entry.id);
  assert.equal(usage.references,entry.recipeReferences,"Reference count changed "+entry.id);
  assert.deepEqual([...usage.roles].sort(),[...entry.roles].sort(),"Item role changed "+entry.id);
  assert.equal(entry.spanishSource,"https://nether.wowhead.com/"+entry.edition+"/tooltip/item/"+entry.id+"?locale=6");
  assert.equal(entry.englishSource,"https://nether.wowhead.com/"+entry.edition+"/tooltip/item/"+entry.id+"?locale=0");
  const [es,en]=await Promise.all([tooltip(entry,6),tooltip(entry,0)]);
  assert.equal(es.name,entry.es,"Wowhead Spanish name changed for "+entry.id);
  assert.equal(en.name,entry.en,"Wowhead English name changed for "+entry.id);
  assert.notEqual(es.name,en.name,"Spanish and English are identical; requires separate validation "+entry.id);
  ok++;
 }
}
await Promise.all(Array.from({length:8},worker));
assert.equal(ok,52);
assert.ok(dict.source.updates.some(x=>x.itemsAdded===52&&x.batch===src.batch&&x.ids.length===52));
console.log("VERIFIED_WOWHEAD_ITEMS_52",JSON.stringify({verified:ok,translated:Object.keys(dict.items).length,
 materials:src.entries.filter(r=>r.roles.includes("material")).length,
 sample:src.entries.slice(0,4).map(r=>({id:r.id,es:r.es}))}));
