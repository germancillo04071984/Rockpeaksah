import assert from "node:assert/strict";
import fs from "node:fs";
import {signature} from "./recipe-match.mjs";
const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const checks=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8"));
assert.equal(checks.schema,1);
assert.equal(checks.entries.length,16,"Se esperaban dieciséis recetas verificadas, incluyendo el último lote de diez");
assert.equal(new Set(checks.entries.map(r=>r.id)).size,checks.entries.length,"ID de receta duplicado");
const response=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(35000)});
assert.ok(response.ok,"Catálogo comercial no disponible: HTTP "+response.status);
const catalog=await response.json();
assert.ok(Array.isArray(catalog.recipes),"Catálogo sin recetas");
const report=[];
for(const check of checks.entries){
 assert.ok(["Leatherworking","Cooking","Alchemy"].includes(check.profession),"Profesión fuera de las tres líneas: "+check.id);
 assert.ok(check.wowheadSpell>0&&check.id!==check.wowheadSpell,"ID de receta comercial no puede confundirse con spell ID");
 assert.ok(check.wowheadUrl.startsWith("https://www.wowhead.com/"));
 assert.ok(typeof check.name==="string"&&check.name.length>5);
 if(check.wowheadEdition){
  const allowedSource=check.wowheadEdition==="Forever"?"/forever/es/spell=":
   check.wowheadEdition==="Classic PTR"?"/classic-ptr/es/spell=":
   check.wowheadEdition==="Classic"?"/classic/es/spell=":null;
  assert.ok(allowedSource,"Edición de Wowhead no reconocida: "+check.wowheadEdition);
  assert.ok(check.wowheadUrl.startsWith("https://www.wowhead.com"+allowedSource),
   "No coincide la edición de Wowhead con su URL: "+check.id);
  const matSignature=[...(check.wowheadMaterials||[])].map(([id,qty])=>id+"x"+qty).sort().join(",");
  const realSignature=[...check.r].map(([id,qty])=>id+"x"+qty).sort().join(",");
  assert.equal(matSignature,realSignature,"Los ingredientes de Wowhead difieren de la receta "+check.id);
 }
 assert.equal(dictionary.recipes[check.id],check.name,"El nombre publicado no coincide con Wowhead");
 const exact=catalog.recipes.filter(r=>r.id===check.id);
 assert.equal(exact.length,1,"Receta ausente o ID ambiguo "+check.id);
 const recipe=exact[0];
 assert.equal(recipe.name,check.nameEn,"El nombre inglés del proveedor cambió en "+check.id);
 const expected=signature({prof:check.profession,item:check.item,qty:check.qty,r:check.r},"market");
 const actual=signature(recipe,"market");
 assert.ok(expected&&actual,"Fabricación sin datos completos "+check.id);
 assert.equal(actual,expected,
  "No coincide la profesión, objeto, producción o ingredientes de la receta "+check.id);
 report.push({id:check.id,english:check.nameEn,spanish:check.name,spellId:check.wowheadSpell,
  output:check.item,quantity:check.qty,reagents:check.r,signature:actual});
}
assert.ok(dictionary.source?.updates?.some(entry=>entry.recipesAdded===3&&
  entry.provenanceFile==="locales/wowhead-checked-recipes.json"),
 "La versión no documenta la procedencia de las tres recetas");
assert.ok(dictionary.source?.updates?.some(entry=>entry.recipesAdded===3&&
 entry.provenanceFile==="locales/wowhead-checked-recipes.json"&&
 entry.ids?.includes(49861)&&entry.ids?.includes(49868)),
 "Falta el origen de las tres recetas de Forever");
assert.ok(dictionary.source?.updates?.some(entry=>entry.recipesAdded===10&&
 entry.provenanceFile==="locales/wowhead-checked-recipes.json"&&
 entry.ids?.length===10&&entry.ids.includes(52015)&&entry.ids.includes(51368)),
 "No consta la procedencia íntegra del lote de diez recetas");
assert.equal(dictionary.source.coverage.translatedRecipes,Object.keys(dictionary.recipes).length);
console.log("WOWHEAD_RECIPE_MATCHES",JSON.stringify(report));
