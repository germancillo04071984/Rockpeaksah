import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {signature} from "./recipe-match.mjs";
const old=JSON.parse(await fs.readFile("locales/esES.json","utf8"));
const get=async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error("HTTP "+r.status+" "+url);
 return r;
};
const market=await (await get("https://auctionhouse.tk.gg/api/recipes")).json();
const ours=market.recipes.filter(r=>/cooking|cocina|alchemy|alquimia|leatherworking|peleter/i.test(String(r.prof)));
const uniqueIds=[...new Set(ours.flatMap(r=>[r.item,...(r.r||[]).map(x=>x[0])]))].filter(x=>Number.isSafeInteger(x)&&x>0);
const unknownItems=uniqueIds.filter(id=>!old.items[id]);
const unknownRecipes=ours.filter(r=>!old.recipes[r.id]);
console.log("BASELINE",JSON.stringify({oldSource:old.source?.createdAt,oldCoverage:old.source?.coverage,
 currentRecipes:ours.length,currentItemIds:uniqueIds.length,untranslatedItems:unknownItems.length,untranslatedRecipes:unknownRecipes.length}));
const sdkSrc=await (await get("https://warcraftforever.com/data/latest.mjs")).text();
const folder=await fs.mkdtemp(path.join(os.tmpdir(),"rockpeaks-es-audit-"));
await fs.writeFile(path.join(folder,"sdk.mjs"),sdkSrc);
const sdk=await import(pathToFileURL(path.join(folder,"sdk.mjs")).href);
const newItems={};
const itemStats={esES:0,enUS:0,missing:0,other:0};
const itemExamples={esES:[],enUS:[],missing:[]};
let pinned=null;
for(let i=0;i<unknownItems.length;i+=50){
 const block=unknownItems.slice(i,i+50);
 const result=await sdk.Items.getMany(block,{locale:"esES",...(pinned?{dataset:pinned}:{})});
 if(pinned&&result.dataset!==pinned)throw Error("Item dataset switched");
 pinned=result.dataset;
 for(const id of block){
  const r=result.data.find(x=>x.id===id);
  const kind=!r?"missing":r.nameLocale==="esES"?"esES":r.nameLocale==="enUS"?"enUS":"other";
  itemStats[kind]++;
  if(itemExamples[kind]?.length<30)itemExamples[kind].push({id,name:r?.name??null,english:market.items?.[id]?.name??null});
  if(kind==="esES")newItems[id]=r.name;
 }
}
console.log("ITEM_GAPS",JSON.stringify({dataset:pinned,stats:itemStats,newItems,examples:itemExamples}));
let recipes=[],cursor=null,recipeDataset=null,page=0;
const cursors=new Set();
do{
 const result=await sdk.Recipes.search("",{locale:"esES",limit:100,includeUnknown:true,...(recipeDataset?{dataset:recipeDataset}:{}),...(cursor?{cursor}:{})});
 if(recipeDataset&&result.dataset!==recipeDataset)throw Error("Recipe dataset switched");
 recipeDataset=result.dataset;
 recipes.push(...result.data);cursor=result.nextCursor||null;page++;
 if(cursor&&cursors.has(cursor))throw Error("Repeated cursor");
 if(cursor)cursors.add(cursor);
 if(page>120)throw Error("Too many pages");
}while(cursor);
const index=new Map(),products=new Map();
for(const r of recipes){
 const sig=signature(r,"client");
 if(sig){const list=index.get(sig)||[];list.push(r);index.set(sig,list)}
 const id=r.product?.item;
 if(id){const list=products.get(id)||[];list.push(r);products.set(id,list)}
}
const gapStats={exactSpanish:0,exactEnglish:0,productNameSpanish:0,noProduct:0,ambiguous:0,otherMismatch:0};
const groups={exactSpanish:[],exactEnglish:[],productNameSpanish:[],noProduct:[],ambiguous:[],otherMismatch:[]};
const freshRecipeNames={};
for(const r of unknownRecipes){
 const sig=signature(r,"market");
 const exact=index.get(sig)||[];
 const sameProduct=products.get(r.item)||[];
 let kind=null,name=null;
 if(exact.filter(x=>x.nameLocale==="esES").length===1){kind="exactSpanish";name=exact.find(x=>x.nameLocale==="esES").name;freshRecipeNames[r.id]=name}
 else if(exact.length>0){kind="exactEnglish"}
 else if(sameProduct.length===0){kind="noProduct"}
 else{
  const sameProf=sameProduct.filter(x=>String(x.profession)===(/alchemy/i.test(r.prof)?"171":/cooking/i.test(r.prof)?"185":"165"));
  const translated=(sameProf.length?sameProf:sameProduct).filter(x=>x.nameLocale==="esES");
  kind=translated.length===1?"productNameSpanish":translated.length>1?"ambiguous":"otherMismatch";
 }
 gapStats[kind]++;
 if(groups[kind].length<60)groups[kind].push({id:r.id,name:r.name,product:r.item,
  output:r.qty,materials:r.r,comparison:sameProduct.slice(0,2).map(x=>({id:x.id,name:x.name,locale:x.nameLocale,profession:x.profession,output:x.product?.count,reagents:x.reagents}))});
}
console.log("RECIPE_GAPS",JSON.stringify({dataset:recipeDataset,sourceRecords:recipes.length,gapStats,verifiedNew:freshRecipeNames,examples:groups}));
