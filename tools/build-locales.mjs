import fs from "node:fs/promises";
import {validatedNames} from "./recipe-match.mjs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const validId=value=>value!==null&&value!==undefined&&value!==""&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const validName=value=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=180&&!/^id\s+\d+$/i.test(value.trim());
async function get(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error("HTTP "+r.status+" para "+url);
 return r;
}
const market=await (await get("https://auctionhouse.tk.gg/api/recipes")).json();
if(!Array.isArray(market?.recipes)||market.recipes.length<1)throw Error("Catálogo vacío.");
const name=String.raw;
const prof=r=>{
 const value=String(r?.prof??"").toLowerCase();
 return /cooking|cocina|alchemy|alquimia|leatherworking|peleter/.test(value);
};
const selected=market.recipes.filter(prof);
const itemIds=[...new Set(selected.flatMap(r=>[
 validId(r.item),
 ...(Array.isArray(r.r)?r.r.map(pair=>Array.isArray(pair)?validId(pair[0]):null):[])
]).filter(Boolean))].sort((a,b)=>a-b);
const recipeIds=[...new Set(selected.map(r=>validId(r.id)).filter(Boolean))].sort((a,b)=>a-b);
console.log("TARGETS",JSON.stringify({catalogRecipes:market.recipes.length,profRecipes:selected.length,recipeIds:recipeIds.length,itemIds:itemIds.length}));
const source=await (await get("https://warcraftforever.com/data/latest.mjs")).text();
const folder=await fs.mkdtemp(path.join(os.tmpdir(),"rockpeaks-sdk-"));
const sdkPath=path.join(folder,"data.mjs");
await fs.writeFile(sdkPath,source);
const sdk=await import(pathToFileURL(sdkPath).href);
if(typeof sdk.Items?.getMany!=="function"||typeof sdk.Recipes?.getMany!=="function")
 throw Error("La biblioteca no admite las consultas por lote esperadas.");
const output={schema:1,locale:"esES",source:{
  name:"Warcraft Forever public professions data",
  verifiedBy:"nameLocale=esES",
  url:"https://warcraftforever.com/developers/data/",
  createdAt:new Date().toISOString(),
  dataset:{items:null,recipes:null},
  coverage:{targetRecipes:recipeIds.length,targetItems:itemIds.length,translatedRecipes:0,translatedItems:0}
},items:{},recipes:{}};
async function transfer(kind,ids,method){
 let dataset=null,translated=0,missing=0,english=0;
 for(let i=0;i<ids.length;i+=50){
  const batch=ids.slice(i,i+50);
  let result=null;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const opts={locale:"esES"};
    if(dataset)opts.dataset=dataset;
    result=await method.getMany(batch,opts);
    if(!Array.isArray(result.data))throw Error("SDK sin lista de datos.");
    if(dataset&&result.dataset!==dataset)throw Error("El origen cambió de versión durante la consulta");
    if(!dataset&&result.dataset)dataset=result.dataset;
    break;
   }catch(err){
    if(attempt===3)throw Error(kind+" grupo "+(i/50+1)+": "+err.message);
    await sleep(attempt*700);
   }
  }
  const received=new Set();
  for(const record of result.data){
   const id=validId(record?.id);
   if(!id||!batch.includes(id))continue;
   received.add(id);
   if(record?.nameLocale==="esES"&&validName(record.name)){
    output[kind][id]=record.name.trim();translated++;
   }else if(validName(record?.name))english++;
  }
  missing+=batch.length-received.size;
  if(i%500===0||i+50>=ids.length){
   console.log("PROGRESS",JSON.stringify({kind,processed:Math.min(ids.length,i+50),total:ids.length,translated,english,missing,dataset}));
  }
  await sleep(60);
 }
 output.source.dataset[kind]=dataset;
 output.source.coverage[kind==="items"?"translatedItems":"translatedRecipes"]=translated;
 console.log("COMPLETED",kind,JSON.stringify({total:ids.length,translated,englishFallback:english,missing,dataset}));
}
await transfer("items",itemIds,sdk.Items);
// Recipe IDs differ between Blizzard's profession API and the client's spell/recipe corpus.
// Never translate by numeric recipe ID alone: require an exact structural match.
if(typeof sdk.Recipes?.search!=="function")throw Error("Recipe search not available.");
const clientRecipes=[];
let cursor=null,pinned=null,pages=0;
const seen=new Set();
do{
 const options={locale:"esES",limit:100,includeUnknown:true};
 if(pinned)options.dataset=pinned;
 if(cursor)options.cursor=cursor;
 const result=await sdk.Recipes.search("",options);
 if(!Array.isArray(result.data)||!result.dataset)throw Error("Incomplete recipe corpus response.");
 if(pinned&&result.dataset!==pinned)throw Error("Recipe dataset switched during paging.");
 pinned=result.dataset;
 clientRecipes.push(...result.data);
 pages++;
 if(pages>120)throw Error("Exceeded safe recipe pagination limit.");
 cursor=result.nextCursor||null;
 if(cursor&&seen.has(cursor))throw Error("Repeated recipe cursor.");
 if(cursor)seen.add(cursor);
 if(pages%10===0||!cursor)console.log("RECIPE_PAGES",pages,"records",clientRecipes.length);
}while(cursor);
const matched=validatedNames(selected,clientRecipes);
output.recipes=matched.names;
output.source.dataset.recipes=pinned;
output.source.coverage.translatedRecipes=Object.keys(matched.names).length;
output.source.coverage.matchMethod="Same profession, product item, output count and complete reagent IDs/quantities";
console.log("MATCHED_RECIPES",JSON.stringify({marketCount:selected.length,clientCount:clientRecipes.length,
 verifiedMatches:matched.matches.length,sourceSignatures:matched.clientSignatures,conflictingSignatures:matched.conflicts}));
if(!Object.keys(output.items).length)
 throw Error("El SDK no devolvió nombres de objetos verificados en español.");
const ordered={...output,
  items:Object.fromEntries(Object.entries(output.items).sort((a,b)=>Number(a[0])-Number(b[0]))),
  recipes:Object.fromEntries(Object.entries(output.recipes).sort((a,b)=>Number(a[0])-Number(b[0])))
};
await fs.mkdir("locales",{recursive:true});
await fs.writeFile("locales/esES.json",JSON.stringify(ordered,null,0)+"\n","utf8");
console.log("OUTPUT",JSON.stringify({bytes:(await fs.stat("locales/esES.json")).size,coverage:ordered.source.coverage}));
