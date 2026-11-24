// Fixed public source, no user-supplied URL, no credentials.
const URL="https://public-data.tradeskillmaster.com/forever/eu/realm/pvp-horde/items.csv";
let cached=null;
module.exports=async function(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).send("Method not allowed")}
 if(cached&&Date.now()-cached.at<3600000){res.setHeader("Cache-Control","public, max-age=300, s-maxage=3600");res.setHeader("Content-Type","text/csv; charset=utf-8");return res.status(200).send(cached.csv)}
 try{
  const r=await fetch(URL,{signal:AbortSignal.timeout(10000),redirect:"error",headers:{Accept:"text/csv"}});
  if(!r.ok){res.setHeader("Cache-Control","no-store");return res.status(502).json({error:"TSM HTTP "+r.status})}
  const csv=await r.text();if(csv.length>5000000||!csv.replace(/^\uFEFF/,"").split(/\r?\n/,1)[0].toLowerCase().split(",").map(x=>x.trim().replace(/^"|"$/g,"")).includes("updatedat"))throw Error("CSV TSM no reconocido");
  cached={at:Date.now(),csv};res.setHeader("Cache-Control","public, max-age=300, s-maxage=3600");res.setHeader("Content-Type","text/csv; charset=utf-8");return res.status(200).send(csv)
 }catch(e){res.setHeader("Cache-Control","no-store");return res.status(502).json({error:"No se pudo leer el CSV público de TSM",detail:e.name})}
};
