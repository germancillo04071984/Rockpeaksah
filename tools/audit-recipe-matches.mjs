import {writeFile} from 'node:fs/promises';
const market=await (await fetch("https://auctionhouse.tk.gg/api/recipes")).json();
const source=await (await fetch("https://warcraftforever.com/data/latest.mjs")).text();
await writeFile("/tmp/rockpeaks-audit-sdk.mjs",source);
const sdk=await import("file:///tmp/rockpeaks-audit-sdk.mjs");
const wanted=[2162,3928,718,2152,3926];
const result=await sdk.Recipes.getMany(wanted,{locale:"esES"});
for(const id of wanted){
 const original=market.recipes.find(x=>x.id===id);
 const translated=result.data.find(x=>x.id===id);
 console.log("COMPARE",JSON.stringify({id,market:original?{prof:original.prof,name:original.name,item:original.item,qty:original.qty,r:original.r}:null,warcraftForever:translated}).slice(0,2100));
}
