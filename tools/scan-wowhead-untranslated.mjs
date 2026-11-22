import fs from "node:fs";
const dict=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const response=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error("Catalog HTTP "+response.status);
const cat=await response.json(),selected=cat.recipes.filter(r=>/^(Leatherworking|Alchemy|Cooking)$/i.test(r.prof)&&!dict.recipes[r.id]);
const byName=new Map();
for(const r of selected){
 const key=normal(r.name),arr=byName.get(key)||[];arr.push(r);byName.set(key,arr);
}
function normal(s){return String(s??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[\u2019']/g,"").replace(/[^a-z0-9]/g,"")}
const ranges=[
 [1213538,1213582],[1213885,1213932],[1213711,1213741],
 [1223769,1223789],[1224614,1224635],
 [1226687,1226691],[1225758,1225765],
 [439099,439122],[461645,461710],
 [448080,448100],[435813,435824],
 // Recipes from earlier research / beyond likely standard SoD blocks:
 [1213500,1213537],[1213920,1213950],
];
const extras=[470359,470370,1213571,1213559,1213892,1213546,1213572,1223774,1223778,1223782,1213717,1213734,1213720,1213726,461692,461706,439108];
const specialRanges=[
 [446182,446230],[429350,429371],[429864,429877],[1213745,1213770]
];
const specialSpells=[426607,435971,448085,1225759,1213751,429354,429869];
const scanRanges=globalThis.process.env.WOWHEAD_SPECIALS==="1"?specialRanges:ranges;
const scanExtras=globalThis.process.env.WOWHEAD_SPECIALS==="1"?specialSpells:extras;
const ids=[...new Set([...scanRanges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>i+a)),...scanExtras])];
const results=[],errors=[];
let pointer=0,foundEnglish=0,foundStructured=0;
const sleep=ms=>new Promise(res=>setTimeout(res,ms));
async function fetchJSON(id,locale){
 let err=null;
 const url="https://nether.wowhead.com/classic/tooltip/spell/"+id+"?locale="+locale;
 for(let n=0;n<3;n++){
  try{
   const resp=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(resp.status===404)return null;
   if(resp.status===429){await sleep(2000*(n+1));continue}
   if(!resp.ok)throw Error("HTTP "+resp.status);
   return await resp.json();
  }catch(e){err=e;if(n<2)await sleep((n+1)*350)}
 }
 errors.push({id,locale,error:String(err||"rate limit")});
 return null;
}
function components(html){
 const m=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
 if(!m)return null;
 const out=[],seen=new Set();
 const rx=/<a\s+[^>]*href="\/classic\/es\/item=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>\s*(?:&nbsp;\((\d+)\))?/g;
 for(const z of m[1].matchAll(rx)){
  const id=Number(z[1]),qty=Number(z[2]||1);
  if(seen.has(id)||id<1||qty<1)return null;
  seen.add(id);out.push([id,qty]);
 }
 return out.length?out:null;
}
function outputID(html){
 const m=html?.match(/Componentes:\s*<br\s*\/?>\s*<div[^>]*>[\s\S]*?<\/div>/i);
 if(!m)return null;
 const after=html.slice(html.indexOf(m[0])+m[0].length);
 const r=after.match(/href="\/classic\/es\/item=(\d+)[^"]*"/);
 return r?Number(r[1]):null;
}
function key(r){return r.slice().sort((a,b)=>a[0]-b[0]).map(([id,n])=>id+"x"+n).join(",")}
async function process(id){
 const english=await fetchJSON(id,0);
 if(!english?.name)return;
 const possibilities=byName.get(normal(english.name))||[];
 if(!possibilities.length)return;
 foundEnglish++;
 const es=await fetchJSON(id,6);
 if(!es){results.push({spell:id,english:english.name,status:"Spanish tooltip missing",matches:possibilities.map(r=>r.id)});return}
 const comp=components(es.tooltip),product=outputID(es.tooltip);
 for(const recipe of possibilities){
  const checks={spanish:typeof es.name==="string"&&es.name.length>1&&normal(es.name)!==normal(english.name),
   english:normal(english.name)===normal(recipe.name),
   item:product===recipe.item,components:comp!==null&&key(comp)===key(recipe.r||[]),
   qty:recipe.qty===1
  };
  if(Object.values(checks).every(Boolean))foundStructured++;
  results.push({id:recipe.id,spell:id,spanish:es.name,english:english.name,profession:recipe.prof,
   item:recipe.item,qty:recipe.qty,reagents:recipe.r,foundProduct:product,foundReagents:comp,
   verified:Object.values(checks).every(Boolean),checks,
   wowheadUrl:"https://www.wowhead.com/classic/es/spell="+id});
 }
}
async function worker(){
 while(pointer<ids.length){const id=ids[pointer++];await process(id)}
}
await Promise.all(Array.from({length:8},worker));
const allVerified=results.filter(x=>x.verified),uniqueVerified=[];
const used=new Set();
for(const r of allVerified){if(!used.has(r.id)){used.add(r.id);uniqueVerified.push(r)}}
console.log("WOWHEAD_RANGE_SCAN",JSON.stringify({targets:selected.length,rangeIds:ids.length,
 foundEnglish,foundStructured,verified:uniqueVerified.length,
 matches:uniqueVerified,partial:results.filter(x=>!x.verified),
 errors:errors.slice(0,20),errorsCount:errors.length,
 unverifiedNames:selected.filter(r=>!used.has(r.id)).map(r=>({id:r.id,name:r.name,product:r.item,qty:r.qty,reagents:r.r}))}));
