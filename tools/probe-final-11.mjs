import fs from "node:fs";
const ids=[
 [50600,446851],[49876,435971],[52011,1225759],
 [51655,1213751],[51717,1214303],
 [50561,446192],[50562,446183],[51206,451706],
 [50563,446189],[50564,446185],[50565,446190]
];
const catalogResponse=await fetch("https://auctionhouse.tk.gg/api/recipes",{signal:AbortSignal.timeout(25000)});
if(!catalogResponse.ok)throw Error("Market HTTP "+catalogResponse.status);
const catalog=new Map((await catalogResponse.json()).recipes.map(r=>[r.id,r]));
async function get(edition,spell,locale){
 const url="https://nether.wowhead.com/"+edition+"/tooltip/spell/"+spell+"?locale="+locale;
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)return {status:r.status};
  const data=await r.json();return {status:r.status,data};
 }catch(e){return {error:String(e)}}
}
function materials(html,edition){
 const block=html?.match(/(?:Componentes|Reagents):\s*<br\s*\/?>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
 if(!block)return null;
 const matches=[...block[1].matchAll(/href="\/(?:classic|forever)\/(?:es|en)\/item=(\d+)[^"]*"[^>]*>[\s\S]*?<\/a>(?:\s*&nbsp;\((\d+)\))?/g)];
 return matches.map(m=>[Number(m[1]),Number(m[2]||1)]);
}
function product(html){
 const block=html?.match(/(?:Componentes|Reagents):\s*<br\s*\/?>\s*<div[^>]*>[\s\S]*?<\/div>/i);
 if(!block)return null;
 const after=html.slice(html.indexOf(block[0])+block[0].length);
 const match=after.match(/href="\/(?:classic|forever)\/(?:es|en)\/item=(\d+)[^"]*"/);
 return match?Number(match[1]):null;
}
function key(rows){return (rows||[]).map(([id,n])=>id+"x"+n).sort().join(",")}
const all=[];
let cursor=0;
async function worker(){
 while(cursor<ids.length){
  const [id,spell]=ids[cursor++];
  const market=catalog.get(id);
  const records={id,spell,market:market?{name:market.name,prof:market.prof,item:market.item,qty:market.qty,materials:market.r}:null,editions:[]};
  for(const edition of ["classic","forever"]){
   const [es,en]=await Promise.all([get(edition,spell,6),get(edition,spell,0)]);
   const value=es.data;
   const mat=materials(value?.tooltip,edition),out=product(value?.tooltip);
   records.editions.push({edition,status:es.status||es.error,
    esName:es.data?.name,enName:en.data?.name,product:out,materials:mat,
    productOK:!!market&&out===market.item,materialsOK:!!market&&key(mat)===key(market.r),
    nameOK:!!market&&en.data?.name===market.name,
    tooltipSnippet:(value?.tooltip||"").slice(0,1500)});
  }
  all.push(records);
 }
}
await Promise.all(Array.from({length:4},worker));
all.sort((a,b)=>ids.findIndex(v=>v[0]===a.id)-ids.findIndex(v=>v[0]===b.id));
console.log("WOWHEAD_LAST11_PROBE",JSON.stringify(all));
