import assert from "node:assert/strict";
import fs from "node:fs";

const dict=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const provenance=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8"));
const last=provenance.entries.filter(x=>x.batch==="wowhead-final-11-2026-11-22");
assert.equal(last.length,11);
const marketResponse=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
assert.ok(marketResponse.ok,"Market recipes are not available");
const byId=new Map((await marketResponse.json()).recipes.map(x=>[x.id,x]));
const key=rows=>[...(rows||[])].sort((a,b)=>a[0]-b[0]).map(([id,n])=>id+"x"+n).join(",");
function parts(html){
 const matched=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
 if(!matched)return null;
 const out=[],seen=new Set();
 const re=/<a\s+[^>]*href="\/classic\/es\/item=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>\s*(?:&nbsp;\((\d+)\))?/g;
 for(const hit of matched[1].matchAll(re)){
  const id=Number(hit[1]),n=Number(hit[2]||1);
  if(seen.has(id)||id<1||n<1)return null;
  seen.add(id);out.push([id,n]);
 }
 return out.length?out:null;
}
function outputItem(html){
 const match=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>[\s\S]*?<\/div>/i);
 if(!match)return null;
 const remainder=html.slice(html.indexOf(match[0])+match[0].length);
 const item=remainder.match(/href="\/classic\/es\/item=(\d+)[^"]*"/);
 return item?Number(item[1]):null;
}
async function get(edition,spell,locale){
 const url="https://nether.wowhead.com/"+edition+"/tooltip/spell/"+spell+"?locale="+locale;
 let err;
 for(let retry=0;retry<3;retry++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error("HTTP "+r.status+" "+url);
   return await r.json();
  }catch(e){err=e;if(retry<2)await new Promise(resolve=>setTimeout(resolve,650*(retry+1)))}
 }
 throw err;
}
let cursor=0,checked=0;
async function worker(){
 while(cursor<last.length){
  const record=last[cursor++];
  const actual=byId.get(record.id);
  assert.ok(actual,"Market recipe missing: "+record.id);
  assert.equal(actual.name,record.nameEn);
  assert.equal(actual.prof,record.profession);
  assert.equal(actual.item,record.item);
  assert.equal(actual.qty,record.qty);
  assert.equal(key(actual.r),key(record.r));
  assert.equal(dict.recipes[record.id],record.name);
  const edition=record.wowheadEdition.toLowerCase();
  const [es,en,classic]=await Promise.all([
   get(edition,record.wowheadSpell,6),
   get(edition,record.wowheadSpell,0),
   edition==="forever"?get("classic",record.wowheadSpell,6):Promise.resolve(null)
  ]);
  assert.equal(es.name,record.name,"Translated name in Wowhead differs: "+record.id);
  assert.equal(en.name,record.nameEn,"English name in Wowhead differs: "+record.id);
  const complete=edition==="forever"?classic:es;
  assert.equal(outputItem(complete.tooltip),record.item,"Crafting output differs: "+record.id);
  assert.equal(key(parts(complete.tooltip)),key(record.r),"Ingredients differ: "+record.id);
  if(record.qty>1)assert.ok(record.outputQuantitySource,"Independent output-quantity evidence missing "+record.id);
  if(record.id===50600){
   assert.equal(record.englishClassicAlias,"Flask of Nightmarish Mojo");
   assert.equal(classic.name,"Frasco de mojo de pesadilla");
  }
  checked++;
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
assert.equal(checked,11);
console.log("FINAL_11_WOWHEAD_RECHECK",JSON.stringify({checked,translated:Object.keys(dict.recipes).length,
 outputMultipliers:last.filter(x=>x.qty>1).map(x=>({id:x.id,quantity:x.qty}))}));
