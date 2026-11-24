import {MARKET,normalizeOverview,normalizeDetail} from "./market-core.mjs";
const BASE="https://auctionhouse.tk.gg";
async function get(path,fetcher){const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),15000);try{const r=await fetcher(BASE+path,{signal:ctrl.signal});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timeout)}}
export async function fetchOverview(fetcher=fetch){return normalizeOverview(await get("/api/m/"+MARKET,fetcher))}
export async function fetchDetail(id,hours=168,fetcher=fetch){if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(hours)||hours<1||hours>720)throw Error("Consulta inválida");return normalizeDetail(await get("/api/m/"+MARKET+"/item/"+id+"?hours="+hours,fetcher),id)}
