"use strict";
(function(g){
 const schema="rockpeaks-character-v1";
 const validInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 function luaUnescape(raw){
  return raw.replace(/\\([0-9]{1,3}|.)/gs,(_,c)=>{
   if(/^[0-9]+$/.test(c)){const n=Number(c);if(n>255)throw Error("Escape decimal Lua inválido.");return String.fromCharCode(n)}
   const map={n:"\n",r:"\r",t:"\t",a:"\x07",b:"\b",f:"\f",v:"\v","\\":"\\",'"':'"',"'":"'"};
   if(!(c in map))throw Error("Escape Lua no reconocido.");
   return map[c];
  });
 }
 function decode(text){
  if(typeof text!=="string"||text.length>1000000)throw Error("La captura supera 1 MB.");
  const trimmed=text.trim();
  if(trimmed.startsWith("{"))return JSON.parse(trimmed);
  const match=trimmed.match(/(?:^|\n)\s*RockpeaksBridgePayload\s*=\s*"((?:\\(?:[0-9]{1,3}|.)|[^"\\])*)"/s);
  if(!match)throw Error("Formato no reconocido. Usa el archivo RockpeaksBridge.lua o una captura JSON compatible.");
  return JSON.parse(luaUnescape(match[1]));
 }
 function validate(value){
  if(!value||typeof value!=="object"||Array.isArray(value)||value.schema!==schema||value.version!==1)
   throw Error("Esta captura no corresponde al exportador Rockpeaks Bridge v1.");
  const c=value.character;
  if(!c||typeof c.name!=="string"||!c.name.trim()||c.name.length>64||
     (c.realm!=null&&(typeof c.realm!=="string"||c.realm.length>120))||
     !validInt(c.gold,0,2000000000)||!validInt(c.level,1,100))
    throw Error("Datos del personaje incompletos o inválidos.");
  if(!validInt(value.capturedAt,1,9999999999))throw Error("Fecha de la captura inválida.");
  const professions=value.professions,bagItems=value.bagItems,knownRecipes=value.knownRecipes;
  if(!Array.isArray(professions)||professions.length>16||!Array.isArray(bagItems)||bagItems.length>1500||
     !Array.isArray(knownRecipes)||knownRecipes.length>20000)
   throw Error("Listas de profesiones, bolsas o recetas inválidas.");
  if(professions.some(p=>!p||typeof p.name!=="string"||p.name.length>120||
    !validInt(p.rank,0,999)||!validInt(p.max,0,999)))
   throw Error("Profesiones inválidas.");
  if(bagItems.some(item=>!item||!validInt(item.id,1,100000000)||!validInt(item.count,1,2000000)))
   throw Error("Bolsa inválida.");
  if(knownRecipes.some(r=>!r||!validInt(r.id,1,100000000)||
   (r.name!=null&&(typeof r.name!=="string"||r.name.length>180))))
   throw Error("Recetas del cliente inválidas.");
  const diagnostics={};
  const allowedStates=["available","partial","unavailable","unobserved"];
  for(const field of ["professions","bags","recipes"]){
   const report=value.diagnostics?.[field];
   const state=allowedStates.includes(report?.state)?report.state:null;
   const reason=typeof report?.reason==="string"?report.reason.slice(0,180):"";
   if(state)diagnostics[field]={state,reason};
  }
  return {schema,version:1,capturedAt:value.capturedAt,
   character:{name:c.name.trim(),realm:(c.realm||"").trim(),gold:c.gold,level:c.level},
   professions:professions.map(p=>({name:p.name,rank:p.rank,max:p.max,id:validInt(p.id,1,100000000)?p.id:null})),
   bagItems:bagItems.map(item=>({id:item.id,count:item.count})),
   knownRecipes:knownRecipes.map(r=>({id:r.id,name:r.name||""})),
   diagnostics};
 }
 function parse(text){return validate(decode(text))}
 g.RockpeaksCharacterCore={schema,decode,validate,parse};
})(window);
