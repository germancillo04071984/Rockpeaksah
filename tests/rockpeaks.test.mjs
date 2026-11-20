import {test} from 'node:test';
import {validatedNames,signature} from '../tools/recipe-match.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const paths=['business.js','catalog-tools.js','recipes.js','scout-core.js','scout.js','catalog-ui.js'];
const html=read('index.html');
const coreCtx={window:{}};
vm.runInNewContext(read('scout-core.js'),coreCtx);
const core=coreCtx.window.RockpeaksScoutCore;
const sampleRecipes={recipes:[
{id:10,name:"Aceite",prof:"Alchemy",item:30,qty:1,r:[[20,2],[21,1]]},
{id:11,name:"Comida",prof:"Cooking",item:40,qty:2,r:[[21,1]]},
{id:12,name:"Cuero",prof:"Leatherworking",item:50,qty:1,r:[[9999,1]]}
],items:{20:{name:"Pez"},21:{name:"Vial",buy:40},30:{name:"Aceite",sell:700},40:{name:"Comida",sell:120},50:{name:"Cuero"}},vendor:{}};
const market={t:1770000000000,f:["ask","vol24","sure24","listed"],items:[
{id:20,o:[100,10,5,500]},{id:21,o:[60,1,1,90]},{id:30,o:[900,11,3,40]},{id:40,o:[null,null,null,null]}
]};
test('All local application scripts are valid JavaScript',()=>{
 for(const file of paths)assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 for(const chunk of html.split('<script>').slice(1).map(x=>x.split('</script>')[0])){
  if(chunk.trim())assert.doesNotThrow(()=>new vm.Script(chunk));
 }
});
test('All script references exist and load in dependency order',()=>{
 const references=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1].split('?')[0]);
 for(const file of paths)assert.ok(references.includes(file),file);
 assert.ok(references.indexOf('catalog-tools.js')<references.indexOf('recipes.js'));
 assert.ok(references.indexOf('scout-core.js')<references.indexOf('scout.js'));
 assert.ok(references.indexOf('scout.js')<references.indexOf('catalog-ui.js'));
});
test('NPC profit uses real vendor value and no auction fee',()=>{
 const result=core.scan(sampleRecipes,market,{channel:'npc',fee:5});
 assert.equal(result.records.length,2);
 const alchemy=result.records.find(x=>x.id===10);
 assert.equal(alchemy.cost,240);
 assert.equal(alchemy.revenue,700);
 assert.equal(alchemy.profit,460);
 assert.equal(alchemy.materials[1].source,'NPC');
 assert.equal(result.stats.missingMaterials,1);
});
test('Auction profit applies commission, non-listed items stay pending',()=>{
 const result=core.scan(sampleRecipes,market,{channel:'ah',fee:5});
 assert.equal(result.records.length,1);
 assert.equal(result.records[0].revenue,855);
 assert.equal(result.records[0].profit,615);
 assert.equal(result.records[0].vol24,11);
 assert.equal(result.records[0].sure24,3);
 assert.equal(result.stats.missingSale,1);
});
test('Auction break-even and relisting losses use only known deposits',()=>{
 const noDeposit=core.scan(sampleRecipes,market,{channel:'ah',fee:5}).records[0];
 assert.equal(noDeposit.breakEvenUnit,253);
 assert.equal(noDeposit.depositCopper,null);
 assert.equal(noDeposit.breakEvenAfterRelist,null);
 assert.equal(noDeposit.afterFailedListing,null);
 assert.equal(noDeposit.downside10,529);
 const deposit=core.scan(sampleRecipes,market,{channel:'ah',fee:5,depositCopper:120}).records[0];
 assert.equal(deposit.profit,615);
 assert.equal(deposit.afterFailedListing,495);
 assert.equal(deposit.breakEvenAfterRelist,379);
 assert.equal(deposit.depositCopper,120);
 assert.throws(()=>core.scan(sampleRecipes,market,{channel:'ah',depositCopper:-1}),/Depósito/);
 const npc=core.scan(sampleRecipes,market,{channel:'npc',depositCopper:120}).records[0];
 assert.equal(npc.depositCopper,null);
 assert.equal(npc.breakEvenUnit,null);
});
test('Missing and zero prices are never treated as valid purchase or sale prices',()=>{
 assert.equal(core.positiveInt(0),null);
 assert.equal(core.positiveInt(null),null);
 assert.equal(core.nonnegativeInt(null),null);
 const empty={t:market.t,f:market.f,items:[{id:30,o:[null,null,null,null]},{id:20,o:[100,1,1,1]}]};
 assert.equal(core.scan(sampleRecipes,empty,{channel:'ah'}).records.length,0);
});
test('Verified localization preserves original names and learned status',()=>{
 const memory=new Map();
 const mockStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const g={dispatchEvent(){}};
 vm.runInNewContext(read('catalog-tools.js'),{window:g,localStorage:mockStorage,CustomEvent:class{}});
 const dict=g.RockpeaksCatalog;
 assert.equal(dict.get('items',6358,'Oil Blackmouth'),'Oil Blackmouth');
 assert.equal(dict.get('items',6358,null),null);
 assert.equal(dict.set('items',6358,'Bocanegra graso','enUS'),false);
 assert.equal(dict.set('items',6358,'Bocanegra graso','esES'),true);
 assert.equal(dict.get('items',6358,'Oil Blackmouth'),'Bocanegra graso');
 assert.equal(dict.setLearned(710,true),true);
 assert.equal(dict.learned(710),true);
 assert.equal(dict.setLearned(710,false),true);
 assert.equal(dict.learned(710),false);
});
test('Browser site metadata identifies version and current market',()=>{
 assert.match(html,/2026-11-20\.13/);
 assert.match(html,/MARKET="eu-2-113"/);
});
test('Live auction and recipe public APIs expose expected structured data',async()=>{
 if(process.env.ROCKPEAKS_LIVE!=='1')return;
 async function fetchJson(url){
  const res=await fetch(url,{signal:AbortSignal.timeout(35000)});
  assert.equal(res.ok,true, 'HTTP '+res.status+' for '+url);
  return res.json();
 }
 const [recipes,market]=await Promise.all([
  fetchJson('https://auctionhouse.tk.gg/api/recipes'),
  fetchJson('https://auctionhouse.tk.gg/api/m/eu-2-113')
 ]);
 assert.ok(Array.isArray(recipes.recipes)&&recipes.recipes.length>0);
 assert.ok(recipes.items&&typeof recipes.items==='object');
 assert.ok(Array.isArray(market.f)&&market.f.includes('ask'));
 assert.ok(Array.isArray(market.items)&&market.items.length>0);
 assert.ok(market.house?.faction==='horde'||market.house?.house===113);
 const live=core.scan(recipes,market,{channel:'npc',fee:5});
 assert.ok(live.stats.total>0);
 console.log('LIVE:',JSON.stringify({recipeCount:recipes.recipes.length,marketItems:market.items.length,comparableNPC:live.stats.valid,staleHours:market.t?(Date.now()-market.t)/3600000:null}));
});

test('Recipe translation is joined by full manufacturing identity, never colliding ID alone',()=>{
 const market=[{id:3928,prof:"Cooking",item:5474,qty:2,r:[[5467,1],[2678,1]]}];
 const client=[
  {id:3928,profession:202,name:"Ardilla mecánica",nameLocale:"esES",product:{item:4401,count:1},reagents:[[4363,1]]},
  {id:998888,profession:185,name:"Carne de kodo a la brasa",nameLocale:"esES",product:{item:5474,count:2},reagents:[[2678,1],[5467,1]]}
 ];
 assert.notEqual(signature(market[0],"market"),signature(client[0],"client"));
 const matched=validatedNames(market,client);
 assert.equal(matched.names[3928],"Carne de kodo a la brasa");
 const notMatched=validatedNames(market,[client[0]]);
 assert.equal(Object.keys(notMatched.names).length,0);
});
test('Published locale dictionary contains only structure-checked names',()=>{
 const data=JSON.parse(read('locales/esES.json'));
 assert.equal(data.schema,1);
 assert.equal(data.locale,"esES");
 assert.match(data.source?.coverage?.matchMethod||"",/profession.*product.*output count.*reagent/i);
 assert.equal(data.items[6358],"Bocanegra graso");
 assert.equal(data.items[3371],"Vial vacío");
 assert.notEqual(data.recipes[3928],"Ardilla mecánica");
 assert.ok(Object.keys(data.recipes).length>0);
});
