import assert from "node:assert/strict";
import fs from "node:fs";
import {signature} from "./recipe-match.mjs";
const dictionary=JSON.parse(fs.readFileSync("locales/esES.json","utf8"));
const checks=JSON.parse(fs.readFileSync("locales/wowhead-checked-recipes.json","utf8"));
assert.equal(checks.schema,1);
assert.equal(checks.entries.length,3,"Se esperaban exactamente tres recetas");
assert.equal(new Set(checks.entries.map(r=>r.id)).size,3,"ID de receta duplicado");
const response=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(35000)});
assert.ok(response.ok,"Catálogo comercial no disponible: HTTP "+response.status);
const catalog=await response.json();
assert.ok(Array.isArray(catalog.recipes),"Catálogo sin recetas");
const report=[];
for(const check of checks.entries){
 assert.equal(check.profession,"Leatherworking");
 assert.ok(check.wowheadSpell>0&&check.id!==check.wowheadSpell,"ID de receta comercial no puede confundirse con spell ID");
 assert.ok(check.wowheadUrl.startsWith("https://www.wowhead.com/"));
 assert.ok(typeof check.name==="string"&&check.name.length>5);
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
assert.equal(dictionary.source.coverage.translatedRecipes,Object.keys(dictionary.recipes).length);
console.log("WOWHEAD_RECIPE_MATCHES",JSON.stringify(report));
