import {materials} from "./economy.mjs";
import {isFresh} from "./market-core.mjs";
export const PROF={cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería",firstaid:"Primeros auxilios"};
export function profession(v){const s=String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();return s.includes("cooking")||s.includes("cocina")?"cooking":s.includes("alchemy")||s.includes("alquimia")?"alchemy":s.includes("leatherworking")||s.includes("peleter")?"leatherworking":/first[\s_-]*aid|primeros[\s_-]*auxilios/.test(s)||s==="129"?"firstaid":null}
const pos=x=>Number.isSafeInteger(x)&&x>0;
const timingIndexes=new WeakMap();
function signature(prof,item,qty,reagents){try{const p=profession(prof);if(!p||!pos(item)||!pos(qty))return null;return JSON.stringify([p,item,qty,materials({r:reagents}).sort((a,b)=>a.id-b.id)])}catch{return null}}
export function timing(r,table){
 if(!table?.rows)return null;
 let index=timingIndexes.get(table);
 if(!index){index=new Map();for(const t of Object.values(table.rows)){
  if(!Array.isArray(t)||!pos(t[2])||!Number.isSafeInteger(t[3])||t[3]<0)continue;
  const key=signature(t[5],t[0],t[1],t[4]);if(!key)continue;
  const value={seconds:Math.max(t[2],t[3])/1000,castSeconds:t[2]/1000,cooldownSeconds:t[3]/1000};
  if(!index.has(key))index.set(key,value);else{const old=index.get(key);if(!old||old.castSeconds!==value.castSeconds||old.cooldownSeconds!==value.cooldownSeconds)index.set(key,null)}
 }timingIndexes.set(table,index)}
 return index.get(signature(r.prof,r.item,r.qty,r.r))??null;
}
export function rankRecipes(catalog,overview,settings={},now=Date.now()){
 if(!Array.isArray(catalog?.recipes)||!catalog.items||!Array.isArray(overview?.items))throw Error("Catálogo o mercado no disponible");
 const fresh=isFresh(overview.t,now),market=new Map(overview.items.map(x=>[x.id,x])),records=[],stats={recipes:0,invalid:0,estimated:0,incomplete:0};
 const saleNpc=id=>[market.get(id)?.vendorSell,catalog.items[id]?.sell].find(pos)??null;
 for(const r of catalog.recipes){
  const prof=profession(r.prof);if(!prof)continue;stats.recipes++;
  if(!pos(r.id)||!pos(r.item)||!pos(r.qty)){stats.invalid++;continue}
  let ms;try{ms=materials(r)}catch{stats.invalid++;continue}
  const saved=settings.recipes?.[r.id]||{},level=settings.levels?.[prof]??null,required=pos(saved.required)?saved.required:null,auto=timing(r,settings.timings),manual=Number.isFinite(saved.seconds)&&saved.seconds>0?saved.seconds:null,seconds=manual===null?auto?.seconds??null:Math.max(manual,auto?.cooldownSeconds??0),timeSource=manual!==null?"manual":auto?"client":null;
  const learned=["yes","no"].includes(saved.learned)?saved.learned:"unknown";
  const availability=required!==null&&Number.isSafeInteger(level)&&level<required?"low":learned==="yes"?"learned":learned==="no"?"unlearned":"unknown";
  const lines=ms.map(m=>{const x=market.get(m.id),ah=fresh&&pos(x?.ask)&&pos(x?.listed)&&x.listed>=m.count?x.ask:null;const v=settings.vendors?.[m.id];const npc=pos(v)?v:null;const unit=ah!==null&&npc!==null?Math.min(ah,npc):ah??npc;return {...m,unit,source:unit===null?null:unit===npc?"npc":"ah",total:unit===null?null:unit*m.count}});
  const cost=lines.every(m=>m.total!==null&&Number.isSafeInteger(m.total))?lines.reduce((s,m)=>s+m.total,0):null;
  const safeCost=pos(cost)?cost:null;
  for(const channel of ["npc","ah"]){
   const sale=channel==="npc"?saleNpc(r.item):fresh&&pos(market.get(r.item)?.ask)&&pos(market.get(r.item)?.listed)?market.get(r.item).ask:null;
   const gross=pos(sale)&&Number.isSafeInteger(sale*r.qty)?sale*r.qty:null,fee=gross===null?null:channel==="ah"?Math.ceil(gross*.05):0,net=gross===null?null:gross-fee;
   const profit=net===null||safeCost===null||!fresh?null:net-safeCost;
   const roi=profit===null?null:profit/safeCost;
   const perHour=profit===null||seconds===null?null:profit*3600/seconds;
   records.push({recipe:r,prof,channel,cost:safeCost,net,profit,roi,seconds,perHour,timeSource,cooldownSeconds:auto?.cooldownSeconds??null,learned,availability,level,required,lines,volume:market.get(r.item)?.estimatedSales??null,missing:!fresh?"Datos antiguos":safeCost===null?"Faltan precios o existencias":sale===null?"Sin precio de venta":null});
   if(profit===null)stats.incomplete++;else stats.estimated++;
  }
 }
 return {records,stats,fresh,t:overview.t};
}
export function filterRanking(records,opts={}){
 const {prof="all",channel="both",availability="all",positive=true,order="hour",query="",name=r=>String(r.recipe.name??"")}=opts;
 const norm=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const q=norm(query.trim());
 const metric=r=>order==="roi"?r.roi:order==="craft"?r.profit:r.perHour;
 return records.filter(r=>(prof==="all"||r.prof===prof)&&(channel==="both"||r.channel===channel)&&(availability==="all"||r.availability===availability)&&(!positive||r.profit!==null&&r.profit>0)&&(!q||norm(name(r)).includes(q)||norm(r.recipe.name).includes(q)||String(r.recipe.id)===q||String(r.recipe.item)===q)).sort((a,b)=>{const x=metric(a),y=metric(b);return (x===null?1:0)-(y===null?1:0)||(y??0)-(x??0)||(b.profit??-Infinity)-(a.profit??-Infinity)||a.recipe.id-b.recipe.id});
}
