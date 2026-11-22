import fs from "node:fs";
const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const live=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(30000)});
if(!live.ok)throw Error("Market HTTP "+live.status);
const market=await live.json();
const recipes=market.recipes.filter(x=>["Cooking","Alchemy","Leatherworking"].includes(x.prof));
const refs=new Map(),roles=new Map();
for(const recipe of recipes){
 const put=(id,role)=>{
  if(!Number.isInteger(id)||id<=0)return;
  refs.set(id,(refs.get(id)||0)+1);
  const roleset=roles.get(id)||new Set();
  roleset.add(role);roles.get(id)||roles.set(id,roleset);
 };
 put(recipe.item,"product");
 for(const pair of recipe.r||[])put(pair[0],"material");
}
const targets=[...refs.keys()].filter(id=>!dictionary.items[id])
 .sort((a,b)=>(refs.get(b)-refs.get(a))||a-b);
async function tooltip(edition,id,locale){
 const url="https://nether.wowhead.com/"+edition+"/tooltip/item/"+id+"?locale="+locale;
 let error;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(r.status===404)return null;
   if(r.status===429||r.status>=500)throw Error("HTTP "+r.status);
   if(!r.ok)return {error:"HTTP "+r.status};
   return await r.json();
  }catch(e){error=String(e);if(attempt<2)await new Promise(res=>setTimeout(res,250*(attempt+1)))}
 }
 return {error};
}
let cursor=0;
const found=[];
const stats={attempted:targets.length,classicSpanish:0,foreverSpanish:0,verifiedDiff:0,identical:0,notFound:0};
async function worker(){
 while(cursor<targets.length){
  const id=targets[cursor++];
  const marketEn=market.items?.[id]?.name||null;
  const entry={id,marketEnglish:marketEn,refCount:refs.get(id),roles:[...(roles.get(id)||[])],editions:{}};
  for(const edition of ["classic","forever"]){
   const [en,es]=await Promise.all([tooltip(edition,id,0),tooltip(edition,id,6)]);
   entry.editions[edition]={
    es:es?.name||null,en:en?.name||null,
    esError:es?.error||null,enError:en?.error||null,
    same:es?.name&&en?.name?es.name.trim()===en.name.trim():null,
    matchesMarket:marketEn?en?.name?.trim().toLowerCase()===marketEn.trim().toLowerCase():null
   };
  }
  const english=entry.editions.classic.en;
  const spanish=entry.editions.classic.es;
  const ok=!!(english&&spanish&&!entry.editions.classic.same&&
   (entry.editions.classic.matchesMarket===true||!marketEn)&&
   !/^\s*Item\s*#\s*\d+\s*$/.test(spanish));
  entry.checkedClassic=ok;
  const esp=entry.editions.forever.es,eng=entry.editions.forever.en;
  entry.checkedForever=!!(esp&&eng&&!entry.editions.forever.same&&
   (entry.editions.forever.matchesMarket===true||!marketEn)&&
   !/^\s*Item\s*#\s*\d+\s*$/.test(esp));
  found.push(entry);
 }
}
await Promise.all(Array.from({length:12},worker));
found.sort((a,b)=>b.refCount-a.refCount||a.id-b.id);
for(const r of found){
 if(r.editions.classic.es)stats.classicSpanish++;
 if(r.editions.forever.es)stats.foreverSpanish++;
 if(r.checkedClassic||r.checkedForever)stats.verifiedDiff++;
 else if(r.editions.classic.same||r.editions.forever.same)stats.identical++;
 else stats.notFound++;
}
console.log("WOWHEAD_ITEM_GAPS",JSON.stringify({totalRecipes:recipes.length,marketItems:refs.size,targets:targets.length,stats,rows:found}));
