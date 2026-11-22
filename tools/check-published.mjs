import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root="https://germancillo04071984.github.io/Rockpeaksah/";
const sourceDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(sourceDir,"index.html"),"utf8");
const release=source.match(/Interfaz Rockpeaks organizada · versión ([0-9.-]+)/)?.[0];
assert.ok(release,"No se puede identificar la versión actual en index.html");
const scriptRefs=[...source.matchAll(/<script src="([^"]+\.js\?[^"]+)"\s*><\/script>/g)].map(m=>m[1]);
assert.ok(scriptRefs.length>=5,"Faltan los scripts versionados en index.html");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function read(url){
 const response=await fetch(url,{headers:{"cache-control":"no-cache"},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("HTTP "+response.status+" "+url);
 return response.text();
}
// Derive expected release from this checkout, never from an obsolete hard-coded version.
let page=null,lastError=null;
for(let attempt=1;attempt<=25;attempt++){
 try{
  page=await read(root+"?version-verification="+Date.now()+"-"+attempt);
  if(!page.includes(release))throw Error("GitHub Pages no publica todavía "+release);
  for(const ref of scriptRefs)
   if(!page.includes('src="'+ref+'"'))throw Error("La página publicada carga un script de otra versión: "+ref);
  lastError=null;break;
 }catch(err){
  lastError=err;
  if(attempt%5===0)console.log("PAGES_NOT_READY",attempt,String(err.message));
  if(attempt!==25)await sleep(4000);
 }
}
if(lastError)throw lastError;
const checks=await Promise.all(scriptRefs.map(async ref=>{
 const relative=ref.split("?")[0];
 const published=await read(root+ref+"&verify="+Date.now());
 const checkedIn=fs.readFileSync(path.join(sourceDir,relative),"utf8");
 assert.equal(published,checkedIn,relative+" publicado difiere del código de main");
 return {path:relative,bytes:published.length};
}));
const localeText=await read(root+"locales/esES.json?verify="+Date.now());
const dictionary=JSON.parse(localeText);
const checkedInDictionary=JSON.parse(fs.readFileSync(path.join(sourceDir,"locales/esES.json"),"utf8"));
assert.deepEqual(dictionary,checkedInDictionary,"El diccionario publicado no coincide con main");
assert.equal(dictionary.schema,1);
assert.equal(dictionary.locale,"esES");
assert.ok(dictionary.source.coverage.matchMethod.includes("profession"));
assert.equal(dictionary.items["6358"],"Bocanegra graso");
assert.equal(dictionary.items["217398"],"Elixir Arcano inferior");
assert.equal(dictionary.items["238639"],"Tortilla del alba");
assert.ok(Object.keys(dictionary.items).length>=1108);
assert.ok(Object.keys(dictionary.recipes).length>=821);
assert.equal(dictionary.recipes["49957"],"Brazales de cuero de guardián");
assert.equal(dictionary.recipes["49958"],"Cinturón de guardián");
assert.equal(dictionary.recipes["49959"],"Pantalones de guardián");
assert.equal(dictionary.source.coverage.translatedItems,Object.keys(dictionary.items).length);
assert.notEqual(dictionary.recipes["3928"],"Ardilla mecánica");
assert.ok(Object.keys(dictionary.recipes).length>0);
const wowheadAudit=JSON.parse(await read(root+"locales/wowhead-checked-recipes.json?verify="+Date.now()));
const checkedInWowheadAudit=JSON.parse(fs.readFileSync(path.join(sourceDir,"locales/wowhead-checked-recipes.json"),"utf8"));
assert.deepEqual(wowheadAudit,checkedInWowheadAudit,"La referencia de Wowhead publicada no coincide con main.");
assert.equal(wowheadAudit.entries.length,3);
const packagePath="downloads/RockpeaksBridge-0.3.0.zip";
const download=await fetch(root+packagePath+"?verify="+Date.now(),{signal:AbortSignal.timeout(15000)});
assert.equal(download.ok,true,"No se puede descargar Rockpeaks Bridge desde la web.");
const zip=Buffer.from(await download.arrayBuffer());
const originalZip=fs.readFileSync(path.join(sourceDir,packagePath));
assert.deepEqual(zip,originalZip,"El ZIP publicado no coincide con el repositorio.");
assert.equal(zip.readUInt32LE(0),0x04034b50,"Cabecera ZIP incorrecta.");
for(const name of ["RockpeaksBridge/RockpeaksBridge.toc","RockpeaksBridge/RockpeaksBridge.lua","RockpeaksBridge/README.md"])
 assert.ok(zip.includes(Buffer.from(name)),"Falta un archivo del addon: "+name);
console.log("PUBLISHED_VERIFY",JSON.stringify({release,scriptFiles:checks,
 recipesSpanish:Object.keys(dictionary.recipes).length,itemsSpanish:Object.keys(dictionary.items).length,
 matching:dictionary.source.coverage.matchMethod,site:root}));
