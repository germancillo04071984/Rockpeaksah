"use strict";
(function(g){
 const key="rockpeaks-localizations-esES-v2",learnedKey="rockpeaks-learned-recipes-v1";
 const kinds=["items","recipes"],data={items:{},recipes:{}};
 const goodId=x=>x!==null&&x!==undefined&&x!==""&&Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
 const goodName=x=>typeof x==="string"&&x.trim().length>0&&x.trim().length<=180&&!/^id\s+\d+$/i.test(x.trim());
 function read(){
  try{
   const obj=JSON.parse(localStorage.getItem(key)||"{}");
   for(const kind of kinds){
    if(!obj?.[kind]||typeof obj[kind]!=="object"||Array.isArray(obj[kind]))continue;
    for(const [rawId,name] of Object.entries(obj[kind])){
     const id=goodId(rawId);
     if(id&&goodName(name))data[kind][id]=name.trim();
    }
   }
  }catch{}
 }
 read();
 let known=[];
 try{
  const raw=JSON.parse(localStorage.getItem(learnedKey)||"[]");
  if(Array.isArray(raw))known=[...new Set(raw.map(goodId).filter(Boolean))].slice(0,15000);
 }catch{}
 const persist=()=>{
  try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}
 };
 const publish=()=>{try{window.dispatchEvent(new CustomEvent("rockpeaks:translation-change"))}catch{}};
 function set(kind,id,name,locale){
  const valid=goodId(id);
  if(!kinds.includes(kind)||!valid||locale!=="esES"||!goodName(name))return false;
  if(data[kind][valid]===name.trim())return false;
  data[kind][valid]=name.trim();return true;
 }
 function get(kind,id,fallback){
  const valid=goodId(id);
  if(valid&&kinds.includes(kind)&&Object.prototype.hasOwnProperty.call(data[kind],valid))return data[kind][valid];
  return arguments.length>=3?fallback:(valid?"ID "+valid:"Sin identificar");
 }
 const isTranslated=(kind,id)=>Boolean(goodId(id)&&data[kind]?.[goodId(id)]);
 const learned=id=>Boolean(goodId(id)&&known.includes(goodId(id)));
 function setLearned(id,value){
  const n=goodId(id);if(!n)return false;
  if(value&&!known.includes(n))known.push(n);
  if(!value)known=known.filter(x=>x!==n);
  try{localStorage.setItem(learnedKey,JSON.stringify(known))}catch{return false}
  try{window.dispatchEvent(new CustomEvent("rockpeaks:learned-change",{detail:{id:n,learned:value}}))}catch{}
  return true;
 }
 const counts=()=>({items:Object.keys(data.items).length,recipes:Object.keys(data.recipes).length,learned:known.length});
 let busy=false,stop=false;
 const stopBatch=()=>{stop=true};
 async function translateAll(input,onProgress){
  if(busy)throw Error("Ya hay una traducción en curso.");
  busy=true;stop=false;
  // The numeric IDs for API recipes and client spells are not interchangeable.
  // Server-side build validates recipe identity by materials, product, quantity, profession.
  const incoming={items:Array.isArray(input?.items)?input.items:[],recipes:[]};
  const targets={items:[],recipes:[]};
  for(const kind of kinds){
   const ids=[...new Set(incoming[kind].map(goodId).filter(Boolean))];
   targets[kind]=ids.filter(id=>!data[kind][id]);
  }
  const pending=targets.items.length+targets.recipes.length;
  let reviewed=0,translated=0,missing=0,failed=0,partial=false;
  const report=kind=>onProgress?.({kind,reviewed,pending,translated,missing,failed,partial,stop,coverage:counts()});
  try{
   const mod=await import("https://warcraftforever.com/data/latest.mjs");
   if(typeof mod?.Items?.getMany!=="function"||typeof mod?.Recipes?.getMany!=="function")
    throw Error("El proveedor no ofrece las consultas en lote de Items y Recipes.");
   for(const kind of kinds){
    let dataset=null;
    for(let i=0;i<targets[kind].length;i+=50){
     if(stop){partial=true;break}
     const batch=targets[kind].slice(i,i+50);
     try{
      const opts={locale:"esES"};if(dataset)opts.dataset=dataset;
      const output=await (kind==="items"?mod.Items:mod.Recipes).getMany(batch,opts);
      if(dataset&&output.dataset!==dataset)throw Error("El dataset ha cambiado durante la traducción de "+kind);
      if(!dataset&&output.dataset)dataset=output.dataset;
      if(!Array.isArray(output.data))throw Error("Respuesta sin datos.");
      let seen=0,changed=false;
      for(const result of output.data){
       if(!batch.includes(Number(result?.id)))continue;
       seen++;
       if(set(kind,result.id,result.name,result.nameLocale)){translated++;changed=true}
      }
      missing+=Math.max(0,batch.length-seen);
      // Store each completed batch, so reloading does not discard progress.
      if(changed){persist();publish()}
     }catch(err){
      failed+=batch.length;
     }
     reviewed+=batch.length;report(kind);
    }
    if(stop){partial=true;break}
   }
   return {reviewed,pending,translated,missing,failed,partial,coverage:counts()};
  }finally{busy=false}
 }
 const exportData=()=>({schema:1,locale:"esES",items:{...data.items},recipes:{...data.recipes},learned:[...known]});
 // Static verified dictionary is built in GitHub Actions from Warcraft Forever's esES client records.
 // Browser-side additions remain possible, and nothing is fabricated for missing IDs.
 let staticState={status:"pending",items:0,recipes:0,source:null,coverage:null,updates:[]};
 async function loadPublished(){
  try{
   const r=await fetch("./locales/esES.json",{cache:"no-store"});
   if(!r.ok)throw Error("Diccionario publicado no disponible ("+r.status+")");
   const obj=await r.json();
   if(obj?.schema!==1||obj?.locale!=="esES"||!obj?.items||!obj?.recipes)
    throw Error("Formato de traducciones no reconocido.");
   let changes=0;
   const structureChecked=typeof obj.source?.coverage?.matchMethod==="string"&&
    obj.source.coverage.matchMethod.includes("profession");
   for(const kind of kinds){
    if(kind==="recipes"&&!structureChecked)continue;
    for(const [id,name] of Object.entries(obj[kind])){
     if(set(kind,id,name,"esES"))changes++;
    }
   }
   staticState={status:"loaded",items:Object.keys(obj.items).length,recipes:structureChecked?Object.keys(obj.recipes).length:0,
    source:obj.source?.dataset??null,coverage:obj.source?.coverage??null,updates:Array.isArray(obj.source?.updates)?obj.source.updates:[]};
   if(changes)persist();
   publish();
  }catch(err){
   staticState={status:"unavailable",items:0,recipes:0,source:null,coverage:null,updates:[],error:err.message};
  }
 }
 const publishedStatus=()=>({...staticState});
 g.RockpeaksCatalog=Object.freeze({get,isTranslated,set,counts,learned,setLearned,translateAll,stopBatch,exportData,publishedStatus});
 loadPublished();
})(window);
