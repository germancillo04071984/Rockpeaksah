import {isFresh} from "./market-core.mjs";
const pos=n=>Number.isSafeInteger(n)&&n>0;
const clamp=n=>Math.max(0,Math.min(100,n));
const median=a=>{const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
export function netUnit(price){return price-Math.ceil(price*5/100)}
export function shortlist(overview,tsm,budget,now=Date.now()){
 if(!isFresh(overview?.t,now)||!pos(budget))return [];
 return overview.items.flatMap(x=>{
  const t=tsm.get(x.id),ref=t?.marketValue;
  if(!pos(x.ask)||!pos(x.listed)||!pos(ref)||!Number.isFinite(t.t)||t.t>now+60000||now-t.t>86400000||x.ask>budget||netUnit(ref)<x.ask*1.2)return [];
  const profit=netUnit(ref)-x.ask;
  return [{...x,reference:ref,referenceTime:t.t,indicativeRoi:profit/x.ask,priority:(profit/x.ask)*Math.min(1,(x.estimatedSales??0)/20)}];
 }).sort((a,b)=>b.priority-a.priority||b.indicativeRoi-a.indicativeRoi||a.id-b.id);
}
export function historyReference(detail,stamp){
 // exclude latest 24 hours so a temporary current low cannot define the reference
 const hour=3600000;
 const points=[...new Map((detail?.hourly||[]).filter(p=>pos(p.price)&&p.t>=stamp-168*hour&&p.t<stamp-24*hour).map(p=>[Math.floor(p.t/hour),p.price])).entries()];
 const days=new Set(points.map(([h])=>Math.floor(h/24)));
 if(points.length<24||days.size<3)return null;
 const values=points.map(p=>p[1]),price=Math.floor(median(values));
 if(!pos(price))return null;
 const mad=median(values.map(p=>Math.abs(p-price)));
 return {price,samples:values.length,days:days.size,regularity:clamp(100*(1-mad/price)),mad};
}
export function assess(item,detail,overview,budget,now=Date.now(),margin=.2,recovery=null){
 if(!isFresh(overview?.t,now)||detail?.t!==overview.t||detail?.id!==item.id||!pos(budget))return {state:"unknown",reason:"Detalle sin instantánea coincidente"};
 const hist=historyReference(detail,overview.t);
 if(!hist)return {state:"unknown",reason:"Histórico insuficiente (24 muestras y 3 días anteriores)"};
 const target=hist.price,net=netUnit(target),maxPrice=Math.floor(net/(1+margin));
 const cheap=detail.tiers.filter(t=>t.price<=maxPrice).sort((a,b)=>a.price-b.price);
 const volume=Number.isSafeInteger(item.estimatedSales)&&item.estimatedSales>=0?item.estimatedSales:null;
 // no suggested quantity if no evidence of turnover; cap at 10% of estimated daily volume
 const cap=volume===null?0:Math.floor(volume*.1);
 let quantity=0,cost=0;const rows=[];
 for(const t of cheap){const n=Math.min(t.quantity,Math.floor((budget-cost)/t.price),cap-quantity);if(n>0){quantity+=n;cost+=n*t.price;rows.push({price:t.price,quantity:n})}if(quantity>=cap||cost>=budget)break}
 // Must buy every displayed unit below the assumed resale price; otherwise cheaper competition remains.
 // Do not suggest market resets or buying extra stock simply to clear competition.
 const cheaper=detail.tiers.filter(t=>t.price<target).reduce((s,t)=>s+t.quantity,0);
 const residual=Math.max(0,cheaper-quantity);
 const profit=quantity?quantity*net-cost:null,roi=cost?profit/cost:null;
 const demand=volume===null?null:clamp(volume/100*100);
 // recovery proxy is NOT a prediction of sell-through; no recovery score without real transactions
 const components={profit:roi===null?null:clamp(roi/.5*100),demand,regularity:hist.regularity,recovery:Number.isFinite(recovery)?clamp(recovery):null,capital:cost?clamp(100*(1-cost/budget)):null};
 const weights={profit:30,demand:30,regularity:20,recovery:15,capital:5};
 let weighted=0,coverage=0;for(const k of Object.keys(weights))if(components[k]!==null){weighted+=components[k]*weights[k];coverage+=weights[k]}
 const score=quantity&&coverage?Math.round(weighted/coverage):null;
 const state=!quantity?"watch":residual>0||detail.truncated!==false?"watch":"candidate";
 return {state,reason:!quantity?(cap===0?"Sin volumen estimado suficiente para dimensionar lote":"Sin tramo rentable con este capital"):residual>0?"Quedan unidades anunciadas por debajo del precio objetivo":detail.truncated!==false?"Libro parcial: competencia no verificable":"Sin competencia inferior en los tramos observados; venta no garantizada",target,net,maxPrice,hist,quantity,cost,profit,roi,volume,residual,rows,score,coverage,components,stress:quantity?quantity*netUnit(Math.floor(target*.9))-cost:null};
}
