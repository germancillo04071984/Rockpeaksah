const pos=v=>v!==null&&v!==undefined&&v!==""&&Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const professions={alchemy:171,cooking:185,leatherworking:165};
function professionId(value){
 if(pos(value))return pos(value);
 const name=String(value??"").toLowerCase();
 for(const [key,id] of Object.entries(professions))if(name.includes(key))return id;
 return null;
}
function reagentsKey(value){
 if(!Array.isArray(value)||!value.length)return null;
 const normalized=[];
 for(const reagent of value){
  if(!Array.isArray(reagent)||!pos(reagent[0])||!pos(reagent[1]))return null;
  normalized.push([pos(reagent[0]),pos(reagent[1])]);
 }
 normalized.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 return normalized.map(([id,qty])=>id+"x"+qty).join(",");
}
export function signature(record,kind){
 if(!record)return null;
 const prof=kind==="client"?professionId(record.profession):professionId(record.prof);
 const output=kind==="client"?pos(record.product?.item):pos(record.item);
 const yieldCount=kind==="client"?pos(record.product?.count):pos(record.qty);
 const materials=reagentsKey(kind==="client"?record.reagents:record.r);
 if(!prof||!output||!yieldCount||!materials)return null;
 return [prof,output,yieldCount,materials].join("|");
}
export function validatedNames(marketRecipes,clientRecipes){
 const names=new Map(),conflicting=new Set();
 for(const record of clientRecipes){
  if(record?.nameLocale!=="esES"||typeof record.name!=="string"||!record.name.trim())continue;
  const key=signature(record,"client");
  if(!key)continue;
  const found=names.get(key);
  if(found&&found!==record.name.trim())conflicting.add(key);
  else names.set(key,record.name.trim());
 }
 const result={},matches=[];
 for(const record of marketRecipes){
  const id=pos(record?.id),key=signature(record,"market");
  if(!id||!key||conflicting.has(key)||!names.has(key))continue;
  result[id]=names.get(key);matches.push(id);
 }
 return {names:result,matches,clientSignatures:names.size,conflicts:conflicting.size};
}
