import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {webkit} from "playwright";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=http.createServer((req,res)=>{
 try{
  const p=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  const absolute=path.resolve(root,"."+(p==="/"?"/index.html":p));
  if(!absolute.startsWith(root+path.sep))throw Error("unsafe");
  if(!fs.statSync(absolute).isFile())throw Error("missing");
  res.writeHead(200,{"content-type":absolute.endsWith(".js")?"application/javascript":absolute.endsWith(".json")?"application/json":"text/html"});
  fs.createReadStream(absolute).pipe(res);
 }catch{res.writeHead(404);res.end("not found")}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await webkit.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
const items={6358:{id:6358,name:"Oil Blackmouth"},3371:{id:3371,name:"Empty Vial",buy:40},6370:{id:6370,name:"Blackmouth Oil",sell:700}};
const recipes={recipes:[{id:718,name:"Blackmouth Oil",prof:"Alchemy",cat:"Oils",item:6370,qty:1,r:[[6358,2],[3371,1]]}],items,vendor:{3371:40}};
const market={house:{faction:"horde",house:113},t:Date.now(),f:["ask","vol24","sure24","listed"],items:[
 {id:6358,name:"Oil Blackmouth",o:[199,10,5,200]},
 {id:3371,name:"Empty Vial",o:[50,0,0,100],buy:40},
 {id:6370,name:"Blackmouth Oil",o:[700,4,1,30],sell:700}
]};
const moduleText=[
 'export const Items={getMany:async ids=>({dataset:"fixture-items",data:ids.map(id=>({id,name:({6358:"Bocanegra graso",3371:"Vial vacío",6370:"Aceite de bocanegra"})[id]||null,nameLocale:"esES"})).filter(x=>x.name),missingIds:[]})};',
 'export const Recipes={getMany:async ids=>({dataset:"fixture-recipes",data:ids.includes(718)?[{id:718,name:"Aceite de bocanegra",nameLocale:"esES"}]:[],missingIds:[]}),',
 'search:async()=>({dataset:"fixture-recipes",coverage:"fixture",data:[{id:718,name:"Aceite de bocanegra",nameLocale:"esES",profession:171,',
 'reagents:[{itemId:6358,count:2},{itemId:3371,count:1}],product:{item:6370,name:"Aceite de bocanegra",count:1}}],nextCursor:null})};'
].join("\n");
await ctx.route("https://auctionhouse.tk.gg/**",async route=>{
 const response=route.request().url().includes("/api/recipes")?recipes:market;
 await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(response)});
});
await ctx.route("https://warcraftforever.com/data/latest.mjs",route=>route.fulfill({
 status:200,contentType:"application/javascript",headers:{"access-control-allow-origin":"*"},body:moduleText
}));
const page=await ctx.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
try{
 await page.goto("http://127.0.0.1:"+server.address().port+"/#recipes",{waitUntil:"load"});
 await page.waitForFunction(()=>document.getElementById('refresh')?.disabled===false,null,{timeout:20000});
 assert.equal(await page.locator('[data-view="recipes"]').getAttribute("aria-selected"),"true");
 await page.locator("#scout-load").click();
 await page.locator(".scout-opportunity").first().waitFor({timeout:20000});
 const summary=await page.locator(".scout-opportunity").first().innerText();
 assert.match(summary,/4p 38c/);
 assert.match(summary,/7p 0c/);
 assert.match(summary,/2p 62c/);
 await page.locator("#scout-channel").selectOption("ah");
 await page.locator("#scout-deposit").fill("1.2");
 await page.waitForFunction(()=>document.querySelector(".scout-opportunity")?.innerText.includes("Depósito perdido: 1p 20c"),null,{timeout:10000});
 const ahText=await page.locator(".scout-opportunity").first().innerText();
 assert.match(ahText,/Precio mínimo de venta/);
 assert.match(ahText,/Depósito perdido: 1p 20c/);
 assert.match(ahText,/Escenario de venta un 10% más barata/);
 await page.locator("#scout-channel").selectOption("npc");
 assert.equal(await page.evaluate(()=>window.RockpeaksCatalog?.learned(718)),false);
 await page.locator('.scout-learned[data-recipe-id="718"]').click();
 await page.waitForFunction(()=>window.RockpeaksCatalog?.learned(718)===true,null,{timeout:10000});
 await page.locator('.scout-learned[data-recipe-id="718"][aria-pressed="true"]').waitFor({timeout:10000});
 assert.match(await page.locator(".scout-opportunity").first().innerText(),/Aprendida/);
 await page.locator("#catalog-backup").click();
 assert.match(await page.locator("#catalog-backup-link").getAttribute("href"),/^blob:/);
 const backupText=await page.evaluate(async()=>await (await fetch(document.getElementById("catalog-backup-link").href)).text());
 const backup=JSON.parse(backupText);
 assert.equal(backup.schema,1);
 assert.ok(backup.learned.includes(718));
 await page.locator("#catalog-restore").setInputFiles({name:"learned.json",mimeType:"application/json",buffer:Buffer.from(backupText)});
 assert.match(await page.locator("#catalog-backup-status").innerText(),/Copia restaurada/);
 await page.locator("#scout-known").check();
 assert.equal(await page.locator(".scout-opportunity").count(),1);
 await page.locator("#catalog-translate").click();
 await page.locator("#catalog-translate:not([disabled])").waitFor({timeout:25000});
 const translationStatus=await page.locator("#catalog-status").innerText();
 assert.match(translationStatus,/Recetas 0\/1/); // Fixture has no structural recipe match; do not assign a colliding spell name.
 assert.match(translationStatus,/productos\/materiales 3\/3/);
 await page.locator("#recipe-load").click();
 await page.locator("#recipe-load:not([disabled])").waitFor({timeout:30000});
 assert.ok((await page.locator("#recipe-count").innerText()).includes("1 recetas"));
 await page.locator("#recipe-results button").first().click();
 assert.equal(await page.locator("#recipe-plan").isVisible(),true);
 const width=await page.evaluate(()=>({screen:innerWidth,body:document.documentElement.scrollWidth}));
 assert.ok(width.body<=width.screen+3,"Horizontal overflow on mobile "+JSON.stringify(width));
 assert.ok((await page.locator("#recipe-profit-heading").innerText()).length>0);
 const recipeDownloadEvent=page.waitForEvent("download",{timeout:10000});
 await page.locator("#recipe-audit").click();
 const recipeDownload=await recipeDownloadEvent;
 assert.equal(recipeDownload.suggestedFilename(),"rockpeaks-auditoria-recetas.csv");
 const recipeFile=await Promise.race([recipeDownload.path(),new Promise((_,reject)=>setTimeout(()=>reject(Error("La descarga de recetas no terminó en 10 segundos")),10000))]);
 const recipeCsv=fs.readFileSync(recipeFile,"utf8");
 assert.match(recipeCsv,/profesion/);
 assert.match(await page.locator("#recipe-download").getAttribute("href"),/^blob:/);
 await page.locator('[data-view="business"]').click();
 await page.locator("#biz-product").fill("Prueba controlada");
 await page.locator("#biz-total").fill("125");
 await page.locator("#biz-add").click();
 const businessDownloadEvent=page.waitForEvent("download",{timeout:10000});
 await page.locator("#biz-csv").click();
 const businessDownload=await businessDownloadEvent;
 assert.equal(businessDownload.suggestedFilename(),"rockpeaks-operaciones.csv");
 const businessFile=await Promise.race([businessDownload.path(),new Promise((_,reject)=>setTimeout(()=>reject(Error("La descarga de negocio no terminó en 10 segundos")),10000))]);
 const businessCsv=fs.readFileSync(businessFile,"utf8");
 assert.match(businessCsv,/Prueba controlada/);
 assert.match(await page.locator("#biz-download").getAttribute("href"),/^blob:/);
 assert.equal(errors.length,0,"Unhandled browser errors: "+errors.join("; "));
 console.log("WEBKIT_MOBILE_PASS",JSON.stringify({viewport:width,catalogStatus:translationStatus,summary:summary.slice(0,250),errors:errors.length}));
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
