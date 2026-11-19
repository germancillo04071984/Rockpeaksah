import assert from "node:assert/strict";
const root="https://germancillo04071984.github.io/Rockpeaksah/";
const version="2026-11-19.10";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function read(url){
 const response=await fetch(url,{headers:{"cache-control":"no-cache"},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("HTTP "+response.status+" "+url);
 return response.text();
}
let page=null,lastError=null;
for(let attempt=1;attempt<=25;attempt++){
 try{
  page=await read(root+"?version-verification="+Date.now()+"-"+attempt);
  if(!page.includes("Interfaz Rockpeaks organizada · versión "+version))throw Error("publicada versión distinta de "+version);
  if(!page.includes("catalog-tools.js?v=ui-20261119-10"))throw Error("el HTML publicado usa scripts antiguos");
  lastError=null;break;
 }catch(err){
  lastError=err;
  if(attempt%5===0)console.log("PAGES_NOT_READY",attempt,String(err.message));
  if(attempt!==25)await sleep(4000);
 }
}
if(lastError)throw lastError;
const scripts=["catalog-tools.js","recipes.js","scout-core.js","scout.js","catalog-ui.js"];
const checks=await Promise.all(scripts.map(async path=>{
 const text=await read(root+path+"?verify="+Date.now());
 assert.ok(text.length>100,path+" vacio");
 return {path,bytes:text.length};
}));
const localeText=await read(root+"locales/esES.json?verify="+Date.now());
const dictionary=JSON.parse(localeText);
assert.equal(dictionary.schema,1);
assert.equal(dictionary.locale,"esES");
assert.ok(dictionary.source.coverage.matchMethod.includes("profession"));
assert.equal(dictionary.items["6358"],"Bocanegra graso");
assert.notEqual(dictionary.recipes["3928"],"Ardilla mecánica");
assert.ok(Object.keys(dictionary.recipes).length>0);
console.log("PUBLISHED_VERIFY",JSON.stringify({version,scriptFiles:checks,
 recipesSpanish:Object.keys(dictionary.recipes).length,itemsSpanish:Object.keys(dictionary.items).length,
 matching:dictionary.source.coverage.matchMethod,site:root}));
