"use strict";
(function(g){
 const pos=v=>v!==null&&v!==undefined&&v!==""&&Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
 const nonneg=v=>v!==null&&v!==undefined&&v!==""&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
 function profession(value){
  const s=String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(s.includes("cooking")||s.includes("cocina"))return "cooking";
  if(s.includes("alchemy")||s.includes("alquimia"))return "alchemy";
  if(s.includes("leatherworking")||s.includes("peleter"))return "leatherworking";
  return null;
 }
 const labels={cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería"};
 function scan(catalog,market,options){
  if(!catalog||!Array.isArray(catalog.recipes)||!catalog.items||!market||!Array.isArray(market.items)||!Array.isArray(market.f))
   throw Error("Las fuentes no contienen el catálogo y el mercado esperados.");
  const channel=options?.channel==="npc"?"npc":"ah",fee=Number(options?.fee??5);
  if(!Number.isFinite(fee)||fee<0||fee>100)throw Error("Comisión fuera de rango.");
  const fields=new Map(market.f.map((name,i)=>[name,i]));
  const listed=new Map(market.items.map(row=>[pos(row?.id),row]).filter(x=>x[0]));
  const records=[],stats={total:0,valid:0,missingMaterials:0,missingSale:0,invalid:0,professions:{cooking:0,alchemy:0,leatherworking:0}};
  const metric=(id,name)=>{const row=listed.get(id),idx=fields.get(name);return row&&idx!==undefined?row.o?.[idx]??null:null};
  const ask=id=>pos(metric(id,"ask"));
  const item=id=>catalog.items[id]||listed.get(id)||{};
  const buy=id=>pos(catalog.vendor?.[id])??pos(catalog.items[id]?.buy)??pos(listed.get(id)?.buy);
  const sell=id=>pos(catalog.items[id]?.sell)??pos(listed.get(id)?.sell);
  for(const r of catalog.recipes){
   const prof=profession(r?.prof);if(!prof)continue;
   stats.total++;stats.professions[prof]++;
   const id=pos(r?.id),productId=pos(r?.item),yieldCount=pos(r?.qty),reagents=Array.isArray(r?.r)?r.r:null;
   if(!id||!productId||!yieldCount||!reagents?.length){stats.invalid++;continue}
   let cost=0,bad=false;const materials=[];
   for(const pair of reagents){
    const ingredientId=Array.isArray(pair)?pos(pair[0]):null,qty=Array.isArray(pair)?pos(pair[1]):null;
    if(!ingredientId||!qty){bad=true;break}
    const ah=ask(ingredientId),vendor=buy(ingredientId);
    if(ah===null&&vendor===null){bad=true;break}
    const chosen=ah!==null&&vendor!==null?(ah<=vendor?{price:ah,source:"subasta"}:{price:vendor,source:"NPC"}):
     ah!==null?{price:ah,source:"subasta"}:{price:vendor,source:"NPC"};
    cost+=chosen.price*qty;
    materials.push({id:ingredientId,name:String(item(ingredientId).name||"ID "+ingredientId),count:qty,
      unitPrice:chosen.price,source:chosen.source,market:ah,vendor});
   }
   if(bad){stats.missingMaterials++;continue}
   const unitSale=channel==="npc"?sell(productId):ask(productId);
   if(unitSale===null){stats.missingSale++;continue}
   const gross=unitSale*yieldCount,revenue=channel==="ah"?Math.floor(gross*(1-fee/100)):gross,profit=revenue-cost;
   records.push({id,prof,profession:labels[prof],name:String(r.name||"Receta "+id),category:String(r.cat||""),
    productId,productName:String(item(productId).name||"ID "+productId),yieldCount,cost,revenue,profit,
    roi:cost>0?profit/cost*100:null,unitSale,channel,fee:channel==="ah"?fee:0,materials,
    vol24:nonneg(metric(productId,"vol24")),sure24:nonneg(metric(productId,"sure24")),
    listedUnits:nonneg(metric(productId,"listed")),lastSoldT:pos(metric(productId,"lastSoldT")),
    saleSource:channel==="ah"?"Precio mínimo anunciado":"Precio al vendedor NPC"});
   stats.valid++;
  }
  return {records,stats,snapshot:market.t??null,channel,fee};
 }
 g.RockpeaksScoutCore=Object.freeze({scan,profession,positiveInt:pos,nonnegativeInt:nonneg});
})(window);
