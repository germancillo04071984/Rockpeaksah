import assert from "node:assert/strict";
import fs from "node:fs";

const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const checked=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8"));
const batch=checked.entries.filter(x=>x.batch==="wowhead-50-2026-11-22");
assert.equal(batch.length,50,"No existe el lote exacto de 50 recetas verificadas");
assert.equal(new Set(batch.map(x=>x.id)).size,50,"Hay recetas duplicadas en el lote");
const response=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
assert.equal(response.ok,true,"Catálogo de recetas no disponible");
const market=new Map((await response.json()).recipes.map(x=>[x.id,x]));
const key=pairs=>pairs.slice().sort((a,b)=>a[0]-b[0]).map(([id,count])=>id+"x"+count).join(",");
function readReagents(html){
 const segment=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
 if(!segment)return null;
 const found=[],unique=new Set();
 const rex=/<a\s+[^>]*href="\/classic\/es\/item=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>\s*(?:&nbsp;\((\d+)\))?/g;
 for(const hit of segment[1].matchAll(rex)){
  const id=Number(hit[1]),qty=Number(hit[2]||1);
  if(id<1||qty<1||unique.has(id))return null;
  unique.add(id);found.push([id,qty]);
 }
 return found.length?found:null;
}
function itemFromCraft(html){
 const m=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>[\s\S]*?<\/div>/i);
 if(!m)return null;
 const tail=html.slice(html.indexOf(m[0])+m[0].length);
 const out=tail.match(/href="\/classic\/es\/item=(\d+)[^"]*"/);
 return out?Number(out[1]):null;
}
async function tooltip(spell,locale){
 const uri="https://nether.wowhead.com/classic/tooltip/spell/"+spell+"?locale="+locale;
 let err;
 for(let tries=0;tries<3;tries++){
  try{
   const res=await fetch(uri,{signal:AbortSignal.timeout(12000)});
   if(res.status===429||res.status>=500)throw Error("Wowhead HTTP "+res.status);
   if(!res.ok)throw Error("Wowhead HTTP "+res.status+" "+uri);
   return await res.json();
  }catch(e){
   err=e;
   if(tries<2)await new Promise(resolve=>setTimeout(resolve,(tries+1)*600));
  }
 }
 throw err;
}
let current=0,verified=0;
async function worker(){
 while(current<batch.length){
  const r=batch[current++];
  const recipe=market.get(r.id);
  assert.ok(recipe,"La receta "+r.id+" ya no aparece en el catálogo");
  assert.equal(recipe.prof,r.profession,"Cambio de profesión "+r.id);
  assert.equal(recipe.name,r.nameEn,"Nombre inglés del mercado cambiado "+r.id);
  assert.equal(recipe.item,r.item,"Producto cambiado "+r.id);
  assert.equal(recipe.qty,1,"Salida múltiple no contemplada "+r.id);
  assert.equal(recipe.qty,r.qty);
  assert.equal(key(recipe.r),key(r.r),"Ingredientes del mercado modificados "+r.id);
  assert.equal(dictionary.recipes[r.id],r.name,"El diccionario no refleja la traducción "+r.id);
  const [es,en]=await Promise.all([tooltip(r.wowheadSpell,6),tooltip(r.wowheadSpell,0)]);
  assert.equal(es.name,r.name,"La traducción de Wowhead cambió "+r.id);
  assert.equal(en.name,r.nameEn,"El nombre inglés de Wowhead cambió "+r.id);
  assert.notEqual(es.name,en.name,"Wowhead no devuelve traducción esES "+r.id);
  assert.equal(itemFromCraft(es.tooltip),r.item,"El producto fabricado no coincide "+r.id);
  assert.equal(key(readReagents(es.tooltip)||[]),key(r.r),"Los reactivos de Wowhead no coinciden "+r.id);
  verified++;
 }
}
await Promise.all(Array.from({length:6},()=>worker()));
assert.equal(verified,50);
console.log("RECHECK_WOWHEAD_50",JSON.stringify({verified,coverage:dictionary.source.coverage,first:batch[0].id,last:batch.at(-1).id}));
