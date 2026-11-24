import {batch,thresholds,advise,materials} from "./economy.mjs";
const assert=(v,msg)=>{if(!v)throw Error(msg)};
let cases=0;
const eq=(a,b,msg)=>{assert(a===b,msg+" got "+a+" expected "+b);cases++};
const r={qty:1,item:1,r:[[2,1],[3,1]]},books=new Map([[2,{tiers:[{price:88,quantity:30},{price:89,quantity:200}]}],[3,{tiers:[{price:39,quantity:30}]}]]),vendors=new Map([[3,{price:40,unlimited:true}]]);
eq(batch(r,books,vendors,100,150).cost,12840,"cost");
eq(batch(r,books,vendors,100,150).profit,2160,"profit");
eq(batch(r,books,vendors,100,200,500).profit,6160,"AH profit");
eq(batch(r,books,new Map(),100,150).complete,false,"no vendor");
eq(batch(r,books,vendors,231,150).complete,false,"stock");
eq(thresholds(r,2,books,vendors,150,200).npc.recommended,97,"threshold");
eq(advise(r,books,vendors,10000,150).n,77,"budget");
eq(advise(r,books,vendors,0,150),null,"no budget");
eq(materials({r:[[2,1],[2,2]]})[0].count,3,"duplicate reagents");
const expensive=new Map([[2,{tiers:[{price:138,quantity:261}]}],[3,{tiers:[{price:45,quantity:300}]}]]);
const confirmed=new Map([[3,{price:40,quantity:100}]]);
eq(batch(r,expensive,confirmed,100,150).profit,-2800,"egg screenshot");
eq(advise(r,expensive,confirmed,100000,150),null,"no loss purchase");
eq(batch(r,expensive,confirmed,101,150).cost,100*178+183,"finite vendor");
const l={qty:2,r:[[2,1],[3,1]]};
eq(batch(l,books,vendors,100,100).units,200,"double yield");
eq(batch(l,books,vendors,100,100).profit,7160,"double yield profit");
eq(advise(r,books,vendors,10000,150).remainingCapital,127,"remaining cash");
let bad=false;try{batch(r,books,vendors,1,150,10001)}catch{bad=true}eq(bad,true,"invalid fee");
eq(batch(r,books,vendors,1,null).complete,false,"missing sale");
let seed=113;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n};
for(let k=0;k<200;k++){const r={qty:1+rand(3),r:[[2,1+rand(3)],[3,1+rand(2)]]};const books=new Map([[2,{tiers:[{price:10+rand(20),quantity:1+rand(10)},{price:40+rand(60),quantity:1+rand(12)}]}],[3,{tiers:[{price:10+rand(30),quantity:1+rand(12)}]}]]);const vendors=rand(2)?new Map([[3,{price:35,quantity:1+rand(10)}]]):new Map();const budget=rand(2500),sale=20+rand(120),fee=rand(2)?500:0,margin=rand(2)?.1:.2;let expected=0,prev=0;for(let n=1;n<=30;n++){const q=batch(r,books,vendors,n,sale,fee);if(!q.complete||q.cost>budget||BigInt(q.net/n)*10000n<BigInt(q.cost-prev)*BigInt(10000+Math.round(margin*10000)))break;expected=n;prev=q.cost}eq(advise(r,books,vendors,budget,sale,fee,margin)?.n??0,expected,"brute force "+k)}

console.log("V2_ADVISOR_PASS",cases);
