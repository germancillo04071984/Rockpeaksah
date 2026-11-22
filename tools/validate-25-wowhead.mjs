import fs from "node:fs";
import assert from "node:assert/strict";
const locale=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const curated=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8")).entries.slice(-25);
assert.equal(curated.length,25,"Debe existir un bloque de 25 entradas contrastadas.");
const must=new Map(curated.map(x=>[x.id,x]));
assert.equal(must.size,25,"ID de receta duplicado en las últimas 25.");
const wanted=[
 [51367,461677],[51369,461649],
 [51371,461655],[51373,461657],[51372,461659],
 [51364,461673],[51366,462227],
 [51393,461722],[51394,461724],
 [51376,461661],[51375,461665],[51377,461663],
 [51383,461754],[51379,461653],[51380,461690],
 [49955,439105],
 [51663,1213521],[51664,1213523],[51665,1213525],
 [51906,1224630],[51901,1224625],[51899,1224623],[51903,1224627],
 [52108,1226690],[49865,435953],
 [49956,439108],[51661,1213508],[51365,461675],[51904,1224628]
];
function canonical(str){return String(str||"").toLowerCase().replace(/['’\-]/g,"").replace(/\s+/g," ").trim()}
function productId(html){
 const marker=html.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>[\s\S]*?<\/div>/i);
 if(!marker)return null;
 const after=html.slice(html.indexOf(marker[0])+marker[0].length);
 const m=after.match(/href="\/classic\/es\/item=(\d+)[^"]*"/);
 return m?Number(m[1]):null;
}
function reagents(html){
 const m=html.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
 if(!m)return null;
 const pairs=[],seen=new Set();
 const pattern=/<a\s+[^>]*href="\/classic\/es\/item=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>\s*(?:&nbsp;\((\d+)\))?/g;
 for(const found of m[1].matchAll(pattern)){
  const id=Number(found[1]),qty=Number(found[2]||1);
  if(!Number.isSafeInteger(id)||!Number.isSafeInteger(qty)||id<1||qty<1||seen.has(id))return null;
  seen.add(id);pairs.push([id,qty]);
 }
 return pairs.length?pairs:null;
}
function key(r){return r.slice().sort((a,b)=>a[0]-b[0]).map(([id,n])=>id+"x"+n).join(",")}
async function get(url){
 let error=null;
 for(let i=0;i<3;i++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(r.status===404)return null;
   if(r.status===429||r.status>=500)throw Error("HTTP "+r.status);
   if(!r.ok)throw Error("HTTP "+r.status);
   return await r.json()
  }catch(err){error=err;if(i<2)await new Promise(resolve=>setTimeout(resolve,500*(i+1)))}
 }
 throw error;
}
const mr=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
if(!mr.ok)throw Error("Market HTTP "+mr.status);
const market=(await mr.json()).recipes;
const catalogue=new Map(market.map(x=>[x.id,x]));
const passed=[],rejected=[];
for(const [id,spell] of wanted){
 const r=catalogue.get(id);
 if(!r){rejected.push({id,spell,reason:"not in market"});continue}
 try{
  const [es,en]=await Promise.all([
   get("https://nether.wowhead.com/classic/tooltip/spell/"+spell+"?locale=6"),
   get("https://nether.wowhead.com/classic/tooltip/spell/"+spell+"?locale=0")
  ]);
  if(!es||!en){rejected.push({id,spell,reason:"tooltip missing"});continue}
  const parts=reagents(es.tooltip),pid=productId(es.tooltip);
  const conditions={
   esName:typeof es.name==="string"&&es.name.trim().length>2&&canonical(es.name)!==canonical(en.name),
   english:canonical(en.name)===canonical(r.name),
   product:pid===r.item,
   materials:parts!==null&&key(parts)===key(r.r||[]),
   quantity:r.qty===1
  };
  if(Object.values(conditions).every(Boolean)){
   if(must.has(id)){
    const stored=must.get(id);
    assert.equal(locale.recipes[id],es.name,"La traducción guardada no coincide con Wowhead "+id);
    assert.equal(stored.name,es.name,"La referencia histórica no coincide con Wowhead "+id);
    assert.equal(stored.wowheadSpell,spell,"El identificador de hechizo no coincide "+id);
    assert.equal(stored.item,r.item,"El objeto fabricado ha cambiado "+id);
    assert.equal(key(stored.wowheadMaterials),key(parts),"Los ingredientes de la referencia no coinciden "+id);
   }
   passed.push({id,profession:r.prof,name:es.name,nameEn:r.name,item:r.item,qty:r.qty,r:r.r,
    wowheadSpell:spell,wowheadUrl:"https://www.wowhead.com/classic/es/spell="+spell,
    wowheadEdition:"Classic",wowheadMaterials:parts,wowheadSource:"nether.wowhead.com/classic/tooltip/spell/"+spell+"?locale=6",
    validation:"Independent Spanish/English Wowhead localized spell tooltips: name, product ID and full reagent identity+quantity checked against live market catalogue"});
  }else rejected.push({id,spell,reason:"mismatch",conditions,es:es.name,en:en.name,market:r.name,productFound:pid,item:r.item,materialsFound:parts,materialsExpected:r.r});
 }catch(err){rejected.push({id,spell,reason:String(err)})}
}
console.log("WOWHEAD_25_AUDIT",JSON.stringify({attempts:wanted.length,passed:passed.length,rejected:rejected.length,records:passed,failed:rejected}));
assert.ok(passed.length>=25,"No se han validado al menos 25 traducciones con la fuente.");
for(const id of must.keys())
 assert.ok(passed.some(x=>x.id===id),"La traducción de la receta "+id+" no ha superado la verificación actual.");
