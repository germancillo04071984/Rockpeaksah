// Reference data only. Never use TSM's aggregate metrics as an order book.
export const TSM_URL="https://public-data.tradeskillmaster.com/forever/eu/realm/pvp-horde/items.csv";
export function csvRows(text){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else quoted=false}else cell+=c;continue}if(c==='"'&&cell===""){quoted=true;continue}if(c===","){row.push(cell);cell="";continue}if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";continue}cell+=c}
 if(quoted)throw Error("CSV incompleto");row.push(cell);if(row.some(Boolean))rows.push(row);return rows;
}
export function parseTSM(text){
 const rows=csvRows(text.replace(/^\uFEFF/,"")),head=rows.shift()?.map(x=>x.trim().toLowerCase())||[];
 const fields=["itemid","name","minbuyout","marketvalue","recent","historical","updatedat"];
 if(fields.some(x=>!head.includes(x)))throw Error("Formato TSM no reconocido");
 const at=Object.fromEntries(head.map((x,i)=>[x,i])),out=new Map();
 const price=v=>/^\d+$/.test(v?.trim()||"")&&Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
 for(const row of rows){if(row.length!==head.length)continue;const id=price(row[at.itemid]),stamp=row[at.updatedat]?.trim();const t=stamp&&/(Z|[+-]\d\d:\d\d)$/i.test(stamp)?Date.parse(stamp):NaN;if(!id||!Number.isFinite(t))continue;const item={id,t,name:row[at.name],minBuyout:price(row[at.minbuyout]),marketValue:price(row[at.marketvalue]),recent:price(row[at.recent]),historical:price(row[at.historical])};if(!out.has(id)||out.get(id).t<t)out.set(id,item)}
 if(!out.size)throw Error("TSM sin filas válidas");return out;
}
export async function fetchTSM(fetcher=fetch){const r=await fetcher("/api/tsm",{signal:AbortSignal.timeout(20000)});if(!r.ok){let message="HTTP "+r.status;try{const d=await r.json();if(d.error)message=d.error}catch{}throw Error(message)}return parseTSM(await r.text())}
