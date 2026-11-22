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
assert.equal(Object.keys(dictionary.items).length,1212);
assert.equal(dictionary.source.coverage.translatedItems,1212);
for(const [id,es] of Object.entries({
 "221021":"Semilla de pesadilla",
 "220688":"Manto de pesadillas inerte",
 "236656":"Runa congelada",
 "234007":"Quitina de silítido con pinchos",
 "234011":"Veneno de acechador Qiraji",
 "213372":"Gniodina aislante",
 "234009":"Madeja de seda Qiraji",
 "211422":"Fragmento del Vacío",
 "215162":"Poción de rejuvenecimiento ligeramente irradiada",
 "233962":"Frasco de locura",
 "227869":"Capa cromática brillante"
}))assert.equal(dictionary.items[id],es,"Traducción de objeto ausente "+id);
assert.equal(Object.keys(dictionary.recipes).length,920);
assert.equal(dictionary.source.coverage.translatedRecipes,920);
const latestTen={
 "51732":"Sopa de Garranegra",
 "51733":"Branquirrojo ahumado",
 "52010":"Filete de merodeador",
 "52012":"Tortilla del alba",
 "52014":"Festín de pez moteado",
 "52015":"Gran festín de langostas",
 "50023":"Elixir Arcano inferior",
 "49863":"Gniodina aislante",
 "49866":"Capucha gneurovinculada brillante",
 "51368":"Coraza de escamas de dragón verde viviente"
};
for(const [id,spanish] of Object.entries(latestTen))
 assert.equal(dictionary.recipes[id],spanish,"La receta nueva "+id+" no aparece traducida");
assert.equal(dictionary.recipes["49861"],"Cuero de tenue resplandor");
assert.equal(dictionary.recipes["49867"],"Caperuza de canalizador gneuroconductora");
assert.equal(dictionary.recipes["49868"],"Almófar de escamas hiperconductoras brillante");
assert.equal(dictionary.recipes["49957"],"Brazales de cuero de guardián");
assert.equal(dictionary.recipes["49958"],"Cinturón de guardián");
assert.equal(dictionary.recipes["49959"],"Pantalones de guardián");
assert.equal(dictionary.source.coverage.translatedItems,Object.keys(dictionary.items).length);
assert.notEqual(dictionary.recipes["3928"],"Ardilla mecánica");
assert.ok(Object.keys(dictionary.recipes).length>0);
const publishedItemAudit=JSON.parse(await read(root+"locales/wowhead-checked-items.json?verify="+Date.now()));
const sourceItemAudit=JSON.parse(fs.readFileSync(path.join(sourceDir,"locales/wowhead-checked-items.json"),"utf8"));
assert.deepEqual(publishedItemAudit,sourceItemAudit,"La fuente de traducciones de objetos publicada no coincide con main");
assert.equal(publishedItemAudit.entries.length,52);
assert.equal(new Set(publishedItemAudit.entries.map(x=>x.id)).size,52);
for(const item of publishedItemAudit.entries){
 assert.equal(dictionary.items[item.id],item.es,"Falta el nombre de objeto en la web: "+item.id);
 assert.ok(item.spanishSource?.startsWith("https://nether.wowhead.com/"));
 assert.ok(item.englishSource?.endsWith("?locale=0"));
}
const finalItemAudit=JSON.parse(await read(root+"locales/wowhead-checked-items-final.json?verify="+Date.now()));
const finalItemSource=JSON.parse(fs.readFileSync(path.join(sourceDir,"locales/wowhead-checked-items-final.json"),"utf8"));
assert.deepEqual(finalItemAudit,finalItemSource,"La evidencia final de 52 objetos publicada no coincide con GitHub");
assert.equal(finalItemAudit.entries.length,52);
assert.equal(new Set([...publishedItemAudit.entries,...finalItemAudit.entries].map(x=>x.id)).size,104);
for(const item of finalItemAudit.entries){
 assert.equal(dictionary.items[item.id],item.es,"La traducción final no está publicada: "+item.id);
 assert.ok(item.spanishSource?.startsWith("https://nether.wowhead.com/"));
 assert.ok(item.englishSource?.endsWith("?locale=0"));
}
assert.equal(dictionary.items["1529"],"Jade");
assert.equal(dictionary.items["227855"],"Disfraz de ogro Gordok sintético");
assert.equal(dictionary.items["252948"],"Brotevil purificado");
const wowheadAudit=JSON.parse(await read(root+"locales/wowhead-checked-recipes.json?verify="+Date.now()));
const checkedInWowheadAudit=JSON.parse(fs.readFileSync(path.join(sourceDir,"locales/wowhead-checked-recipes.json"),"utf8"));
assert.deepEqual(wowheadAudit,checkedInWowheadAudit,"La referencia de Wowhead publicada no coincide con main.");
assert.equal(wowheadAudit.entries.length,102);
assert.deepEqual(wowheadAudit.entries.slice(3,6).map(r=>r.wowheadSpell),[435819,435951,435949]);
assert.deepEqual(wowheadAudit.entries.slice(6,16).map(r=>r.id),
 [51732,51733,52010,52012,52014,52015,50023,49863,49866,51368]);
const last25=wowheadAudit.entries.slice(16,41);
assert.equal(last25.length,25);
assert.deepEqual(last25.map(e=>e.id),
 [51367,51369,51371,51373,51372,51364,51366,51393,51394,
  51376,51375,51377,51383,51379,51380,49955,51663,51664,51665,
  51906,51901,51899,51903,52108,49865]);
for(const entry of last25){
 assert.equal(dictionary.recipes[entry.id],entry.name,
  "La traducción confirmada en Wowhead no se ha publicado: "+entry.id);
 assert.ok(entry.wowheadSource?.startsWith("https://nether.wowhead.com/classic/tooltip/spell/"),
  "Falta la procedencia verificable de "+entry.id);
}
const last50=wowheadAudit.entries.slice(41,91);
assert.equal(last50.length,50);
assert.equal(new Set(last50.map(entry=>entry.id)).size,50);
for(const entry of last50){
 assert.equal(dictionary.recipes[entry.id],entry.name,
  "La nueva traducción de la receta "+entry.id+" no está publicada");
 assert.equal(entry.batch,"wowhead-50-2026-11-22");
 assert.ok(entry.wowheadSource?.startsWith("https://nether.wowhead.com/classic/tooltip/spell/"));
 assert.ok(entry.wowheadEnglishSource?.endsWith("?locale=0"));
}
const final11=wowheadAudit.entries.slice(91);
assert.equal(final11.length,11);
assert.deepEqual(final11.map(e=>e.id),
 [50600,49876,52011,51655,51717,50561,50562,51206,50563,50564,50565]);
for(const entry of final11){
 assert.equal(dictionary.recipes[entry.id],entry.name,"No aparece traducida la receta "+entry.id);
 assert.equal(entry.batch,"wowhead-final-11-2026-11-22");
 assert.ok(entry.wowheadSource?.startsWith("https://nether.wowhead.com/"));
}
assert.equal(dictionary.recipes["50600"],"Jarra de mojo de pesadilla");
assert.equal(dictionary.recipes["49876"],"Poción de rejuvenecimiento ligeramente irradiada");
assert.equal(dictionary.recipes["52011"],"Filete de falda");
assert.equal(final11.find(e=>e.id===49876).qty,5);
assert.equal(final11.find(e=>e.id===52011).qty,2);
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
