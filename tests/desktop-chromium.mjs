import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=http.createServer((request,response)=>{
 try{
  const urlPath=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);
  const filename=path.resolve(root,"."+(urlPath==="/"?"/index.html":urlPath));
  if(!filename.startsWith(root+path.sep)||!fs.statSync(filename).isFile())throw Error("invalid");
  response.writeHead(200,{"content-type":filename.endsWith(".js")?"application/javascript":
   filename.endsWith(".json")?"application/json":"text/html"});
  fs.createReadStream(filename).pipe(response);
 }catch{response.writeHead(404);response.end("not found")}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage(),errors=[];
page.on("pageerror",err=>errors.push(err.message));
await context.route("https://auctionhouse.tk.gg/**",route=>{
 const url=route.request().url();
 const result=url.includes("/api/m/")?{t:Date.now(),f:["ask"],items:[]}:
   {recipes:[],items:{},vendor:{}};
 return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(result)});
});
await context.route("https://warcraftforever.com/**",route=>route.abort());
try{
 await page.goto("http://127.0.0.1:"+server.address().port+"/#business",{waitUntil:"load"});
 await page.locator("#bridge-link").waitFor();
 await page.locator("#biz-product").fill("Registro previo");
 await page.locator("#biz-total").fill("300");
 await page.locator("#biz-add").click();
 const history=await page.locator("#biz-history").innerText();

 await page.evaluate(()=>{
  const snapshot={schema:"rockpeaks-character-v1",version:1,capturedAt:1795356000,
   character:{name:"Rockpeaks",realm:"EU PvP",level:31,gold:18234},
   professions:[{name:"Alquimia",rank:75,max:150,id:171}],
   bagItems:[{id:3685,count:40}],knownRecipes:[{id:718,name:"Aceite de bocanegra"}]};
  const serialize=v=>'RockpeaksBridgePayload = "'+JSON.stringify(v).replaceAll("\\","\\\\").replaceAll('"','\\"')+'"';
  window.__rockpeaksMock={snapshot,version:1,allowed:true};
  window.showOpenFilePicker=async()=>[{
   name:"RockpeaksBridge.lua",
   queryPermission:async()=>window.__rockpeaksMock.allowed?"granted":"prompt",
   requestPermission:async()=>{window.__rockpeaksMock.allowed=true;return "granted"},
   getFile:async()=>({
    size:5000,lastModified:window.__rockpeaksMock.version,
    text:async()=>serialize(window.__rockpeaksMock.snapshot)
   })
  }];
 });
 await page.locator("#bridge-link").click();
 await page.waitForFunction(()=>document.querySelector("#bridge-auto-status")?.textContent.includes("Sincronización activa"),null,{timeout:10000});
 assert.match(await page.locator("#bridge-summary").innerText(),/1o 82p 34c/);
 assert.equal(await page.locator("#biz-history").innerText(),history);

 await page.evaluate(()=>{
  window.__rockpeaksMock.snapshot.character.gold=22222;
  window.__rockpeaksMock.snapshot.capturedAt+=100;
  window.__rockpeaksMock.version++;
  window.dispatchEvent(new Event("focus"));
 });
 await page.waitForFunction(()=>document.querySelector("#bridge-summary")?.textContent.includes("2o 22p 22c"),null,{timeout:10000});

 await page.evaluate(()=>{
  window.__rockpeaksMock.snapshot.character.name="OtroPersonaje";
  window.__rockpeaksMock.snapshot.character.gold=999999;
  window.__rockpeaksMock.version++;
  window.dispatchEvent(new Event("focus"));
 });
 await page.waitForFunction(()=>document.querySelector("#bridge-auto-status")?.textContent.includes("no a Rockpeaks"),null,{timeout:10000});
 assert.match(await page.locator("#bridge-summary").innerText(),/2o 22p 22c/);

 await page.evaluate(()=>{window.__rockpeaksMock.allowed=false;window.dispatchEvent(new Event("focus"))});
 await page.locator("#bridge-authorize").waitFor({state:"visible",timeout:10000});
 await page.locator("#bridge-authorize").click();
 await page.waitForFunction(()=>document.querySelector("#bridge-auto-status")?.textContent.includes("no a Rockpeaks"),null,{timeout:10000});
 assert.equal(await page.locator("#biz-history").innerText(),history);
 assert.equal(errors.length,0,"Unhandled browser errors: "+errors.join("; "));
 console.log("CHROMIUM_FILE_SYNC_PASS",JSON.stringify({businessPreserved:true,permissionRenewal:true,wrongCharacterRejected:true}));
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
