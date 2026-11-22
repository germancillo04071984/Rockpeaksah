const urls=[
 "https://nether.wowhead.com/classic/tooltip/spell/461722?locale=6",
 "https://nether.wowhead.com/classic/tooltip/spell/461722?locale=esES",
 "https://nether.wowhead.com/forever/tooltip/spell/461722?locale=6",
 "https://nether.wowhead.com/classic/tooltip/item/227848?locale=6",
 "https://www.wowhead.com/classic/es/spell=461722",
 "https://www.wowhead.com/classic/es/spell=461655",
 "https://www.wowhead.com/forever/es/spell=461655"
];
for(const url of urls){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{"user-agent":"Mozilla/5.0 (compatible; RockpeaksAH/1.0)","accept":"application/json,text/html,*/*"}});
  const body=await r.text();
  console.log("WOWHEAD_PROBE",JSON.stringify({url,status:r.status,redirect:r.url,contentType:r.headers.get("content-type"),length:body.length,preview:body.slice(0,800)}));
 }catch(err){console.log("WOWHEAD_PROBE_ERROR",JSON.stringify({url,error:String(err)}))}
}
