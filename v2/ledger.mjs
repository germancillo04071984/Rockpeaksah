export const DIV={cooking:"Cocina",alchemy:"Alquimia",leatherworking:"Peletería",firstaid:"Primeros auxilios",resale:"Reventa",conversion:"Conversión de materiales",general:"General"};
export const TYPES={capital:"Aportación de oro",withdraw:"Retirada de oro",buy:"Compra",own:"Material propio / existencias iniciales",craft:"Fabricación",sale:"Venta",expense:"Gasto / depósito perdido",loss:"Pérdida de existencias"};
const int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min&&x<=900000000000;
const need=(ok,msg)=>{if(!ok)throw Error(msg)};
export function copper(s){const m=String(s).trim().replace(",",".").match(/^(\d+)(?:\.(\d{1,4}))?$/);need(m,"Introduce oros con hasta cuatro decimales");const n=Number(m[1])*10000+Number((m[2]||"").padEnd(4,"0"));need(int(n),"Importe fuera de rango");return n}
const add=(a,b)=>{const n=a+b;need(Number.isSafeInteger(n)&&Math.abs(n)<=900000000000,"Importe fuera de rango");return n};
const part=(total,n,qty)=>Number(BigInt(total)*BigInt(n)/BigInt(qty));
const key=(division,item)=>division+":"+item;
const validDiv=d=>Object.hasOwn(DIV,d);
export function replay(events){
 need(Array.isArray(events)&&events.length<=20000,"Libro inválido o demasiado grande");
 let cash=0,contributed=0,withdrawn=0,realized=0,last=0;const stock=new Map(),divisions=Object.fromEntries(Object.keys(DIV).map(d=>[d,{profit:0,sales:0,cost:0,expenses:0}])),history=[],purchases=new Map(),ids=new Set();
 function put(d,i,n,c,t,origin=null){need(validDiv(d)&&int(i,1)&&int(n,1)&&int(c),"Existencias inválidas");const k=key(d,i);if(!stock.has(k))stock.set(k,[]);stock.get(k).push({qty:n,cost:c,at:t,origin})}
 function take(d,i,n){need(int(i,1)&&int(n,1),"Cantidad inválida");const ls=stock.get(key(d,i))||[];need(ls.reduce((s,l)=>add(s,l.qty),0)>=n,"Existencias insuficientes para el objeto #"+i+" en "+DIV[d]);let left=n,cost=0;const slices=[];for(const l of ls){if(!left)break;const q=Math.min(left,l.qty);if(!q)continue;const c=part(l.cost,q,l.qty);slices.push({qty:q,cost:c,origin:l.origin,at:l.at});l.qty-=q;l.cost-=c;left-=q;cost=add(cost,c)}stock.set(key(d,i),ls.filter(l=>l.qty));return {cost,slices}}
 function charge(n){need(int(n)&&cash>=n,"Capital empresarial insuficiente");cash-=n}
 for(const e of events){
  need(e&&typeof e.id==="string"&&e.id.length>0&&e.id.length<=100&&!ids.has(e.id)&&Object.hasOwn(TYPES,e.type),"Operación inválida o repetida");ids.add(e.id);need(Number.isSafeInteger(e.at)&&e.at>0&&e.at>=last&&e.at<=Date.now()+60000,"Fecha inválida: registra en orden cronológico");last=e.at;need(validDiv(e.division),"División inválida");need(typeof e.note==="string"&&e.note.length<=500,"Nota inválida");
  const d=e.division,v=divisions[d];let delta=0,cogs=0,gross=0;
  if(e.type==="capital"){need(int(e.amount,1),"Importe inválido");cash=add(cash,e.amount);contributed=add(contributed,e.amount)}
  if(e.type==="withdraw"){need(int(e.amount,1),"Importe inválido");charge(e.amount);withdrawn=add(withdrawn,e.amount)}
  if(e.type==="buy"||e.type==="own"){need(int(e.item,1)&&int(e.qty,1)&&int(e.amount,e.type==="buy"?1:0),"Compra o existencias inválidas");if(e.type==="buy"){charge(e.amount);if(d==="resale")purchases.set(e.id,{item:e.item,at:e.at,cost:e.amount,net:0,qty:e.qty,sold:0,recoveredAt:null})}else contributed=add(contributed,e.amount);put(d,e.item,e.qty,e.amount,e.at,e.type==="buy"&&d==="resale"?e.id:null)}
  if(e.type==="craft"){need(int(e.item,1)&&int(e.qty,1)&&Array.isArray(e.inputs)&&e.inputs.length>0&&e.inputs.length<=100,"Fabricación inválida");for(const m of e.inputs)cogs=add(cogs,take(d,m.item,m.qty).cost);put(d,e.item,e.qty,cogs,e.at)}
  if(e.type==="sale"){need(int(e.item,1)&&int(e.qty,1)&&int(e.amount,1)&&int(e.fee)&&e.fee<=e.amount&&["npc","ah"].includes(e.channel),"Venta inválida");need(e.channel!=="npc"||e.fee===0,"La venta NPC no tiene comisión");const t=take(d,e.item,e.qty);cogs=t.cost;gross=e.amount;const net=gross-e.fee;cash=add(cash,net);delta=net-cogs;v.sales=add(v.sales,net);v.cost=add(v.cost,cogs);let remaining=net,units=e.qty;for(const s of t.slices){const revenue=part(remaining,s.qty,units);remaining-=revenue;units-=s.qty;if(s.origin&&purchases.has(s.origin)){const p=purchases.get(s.origin);p.net=add(p.net,revenue);p.sold+=s.qty;if(p.recoveredAt===null&&p.net>=p.cost)p.recoveredAt=e.at}}}
  if(e.type==="expense"){need(int(e.amount,1),"Gasto inválido");charge(e.amount);delta=-e.amount;v.expenses=add(v.expenses,e.amount)}
  if(e.type==="loss"){cogs=take(d,e.item,e.qty).cost;delta=-cogs;v.expenses=add(v.expenses,cogs)}
  realized=add(realized,delta);v.profit=add(v.profit,delta);history.push({...e,delta,cogs,gross,cash});
 }
 const inventory=[];let stockValue=0;
 for(const [k,lots] of stock){if(!lots.length)continue;const [division,i]=k.split(":");const qty=lots.reduce((s,l)=>add(s,l.qty),0),cost=lots.reduce((s,l)=>add(s,l.cost),0);inventory.push({division,item:Number(i),qty,cost});stockValue=add(stockValue,cost)}
 const equity=add(cash,stockValue);need(equity===contributed-withdrawn+realized,"Error de conciliación");
 const recovery=new Map();for(const p of purchases.values()){if(!recovery.has(p.item))recovery.set(p.item,{total:0,recovered:0,hours:[],sold:0,quantity:0});const r=recovery.get(p.item);r.total++;r.sold+=p.sold;r.quantity+=p.qty;if(p.recoveredAt!==null){r.recovered++;r.hours.push((p.recoveredAt-p.at)/3600000)}}
 for(const r of recovery.values()){r.hours.sort((a,b)=>a-b);const n=r.hours.length;r.medianHours=n?(r.hours[Math.floor((n-1)/2)]+r.hours[Math.floor(n/2)])/2:null}
 return {cash,contributed,withdrawn,realized,inventory,stockValue,equity,divisions,history,recovery}
}
export function recoveryScore(r){if(!r||r.total<5||r.recovered<3||!Number.isFinite(r.medianHours))return null;return Math.round(100*r.recovered/r.total*Math.min(1,24/Math.max(24,r.medianHours)))}
