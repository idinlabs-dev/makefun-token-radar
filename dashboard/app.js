// Token Launch Radar: #/ board, #detail=<slug>, #filter=watchlist|lowcost, #view=validation.
// Data: window.TOKEN_RADAR (data.js, packed per docs/packing.md). Bands: P15/P85 = IV x exp(q) x smear; P50 has NO smear.
const D=window.TOKEN_RADAR;
const $=id=>document.getElementById(id);
const B36=s=>parseInt(s,36);
const sl=D.s.split("\n");
const nd={};D.nd.split("|").forEach(e=>{const p=e.indexOf(":");nd[+e.slice(0,p)]=e.slice(p+1)});
const nm=i=>nd[i]||sl[i].split("-").map(w=>w?w[0].toUpperCase()+w.slice(1):w).join(" ");
const sp=a=>a.split(",");
const T=sp(D.t),G=sp(D.g),A=sp(D.a),P=sp(D.p),B=sp(D.b),IV=sp(D.iv),R=sp(D.r);
const cat=i=>D.cat[B36(D.c.slice(2*i,2*i+2))];
const xm={};D.x.split("|").forEach(e=>{const p=e.indexOf(":");xm[+e.slice(0,p)]=e.slice(p+1).split(".").map(B36)});
const mm={};if(D.m)D.m.split("|").forEach(e=>{const p=e.indexOf(":");mm[+e.slice(0,p)]=B36(e.slice(p+1))*1000});
const wset=new Set(sp(D.w).map(B36));
const chn=i=>{const p=P[i];return p===""?null:D.ch[B36(p)]};
const chains=rk=>{const o=[chn(B36(B[rk]))];(xm[rk]||[]).forEach(x=>{const c=D.ch[x];if(c&&o.indexOf(c)<0)o.push(c)});return o.filter(Boolean)};
const med=a=>{a=[...a].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
const medAge=med(A.filter(x=>x!=="").map(B36));
const medChg=med(G.filter(x=>x!=="").map(x=>B36(x)/10-100));
const rows=B.map((bi,rk)=>{const i=B36(bi),iv=B36(IV[rk])*1000,w=B36(R[rk])/1000;
 const tvl=B36(T[i])*1000,chs=chains(rk),chg=G[i]===""?null:B36(G[i])/10-100,age=A[i]===""?null:B36(A[i]);
 return{rk:rk+1,i,slug:sl[i],name:nm(i),cat:cat(i),chs,tvl,chg,age,iv,w,
 p15:iv*Math.exp(D.q15)*D.smear,p85:iv*Math.exp(D.q85)*D.smear,pool:iv*.07*(.5+.5*w),wl:wset.has(i)}});
const bySlug={};rows.forEach(r=>bySlug[r.slug]=r);
const money=n=>n>=1000?"$"+Math.round(n).toLocaleString("en-US"):n>=1?"$"+n.toFixed(2).replace(/\.00$/,""):"$"+n.toFixed(2);
const f$=n=>n>=1e9?"$"+(n/1e9).toFixed(2)+"B":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"k":"$"+Math.round(n);
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;");
// --- chain fees (USD per tx, confirm min) ---
const CF={Ethereum:[2.5,3],Solana:[.02,1],Base:[.05,1],Arbitrum:[.08,1],Optimism:[.1,1],Polygon:[.05,1],Binance:[.15,1],"BNB Chain":[.15,1],Avalanche:[.2,1],Hyperliquid:[.05,1],"Hyperliquid L1":[.05,1],Monad:[.03,1],Unichain:[.04,1],Sui:[.03,1],Aptos:[.03,1],Sei:[.03,1],Berachain:[.1,1],Plasma:[.08,1],Linea:[.06,1],Scroll:[.08,1],zkSync:[.08,1],Starknet:[.1,1],Mantle:[.06,1],Blast:[.06,1],Mode:[.05,1],Fantom:[.1,1],Cronos:[.1,1],Gnosis:[.08,1],Celo:[.05,1],Near:[.03,1],Cosmos:[.05,1],Bitcoin:[1.2,10],Tron:[.1,1],Ton:[.05,1],Flare:[.05,1],Movement:[.04,1],MegaETH:[.02,1],Abstract:[.04,1],Katana:[.05,1],Ink:[.05,1],Sonic:[.05,1],Worldchain:[.05,1],Kava:[.08,1],SeiChain:[.03,1]};
const ci=c=>CF[c]||[.3,2];
const FR=[" position "," so the wallet shows "," confirm the"," {N} after ","after 60 days and "," a second "," instead of "," for 60 days"," and keep ","f the {N} "," {N} on {C}"," allocation","Deposit {A} into"," the first"," strategy "," week for four weeks, about {A*0.1} per "," long-lived","ithdraw hal"," the remaining {N}"," on-chain "," {N} ({C}) "," collateral"," and re-deposit","on {N} for at least 30 days"," the same ","on {C} and"," different","gwithdrawing "," {A*0.2} withdrawal from"," health factor above 2 ","half running",", so activity spans t"," liquidity ",", not a one-day farm"," before adding more "," before depositing ",", about {A","two weeks "," and note "," the funding rate ","r 30 days ","and record each ","brepeat usage ","Add {A*0.5} to"," {A} of USDC ","Leave the {N}"," eligibility "," in your own "," half the {N}"," a {A*0.2} re"];
const dec=s=>{for(let i=FR.length-1;i>=0;i--)s=s.split("~"+String.fromCharCode(i<26?97+i:65+i-26)).join(FR[i]);return s};
const PB={"Dexs":[["Swap~Sfor the pool's base asset on~uin two trades so slippage stays low ","2,6,0.2,30,0.18"],["Add {A} as~Gto {N}'s deepest {C} pool~ithe LP receipt in~ywallet ","2,8,0.3,60,0.22"],["Route one real swap a week through~k~gyour usual DEX~K/5} each,~~Q","1,4,0.04,30,0.12"],["Stake or lock the LP~a~x if the app offers a lock, and screenshot the lock receipt ","1,5,0.2,30,0.16"],["Provide {A} of~Gto a second, smaller {C} pool on {N} to widen your footprint beyond the top pair ","2,8,0.12,45,0.1"],["Claim any trading-fee accrual on {N} weekly and re-add it to the pool~~Bit ","1,5,0.02,30,0.08"],["~T~aopen~h, then w~rf~i~E so the wallet history shows a~q~a","2,6,0.1,60,0.14"]],"Lending":[["Supply~Sto~k as~v and~c deposit receipt in the app ","1,5,0.3,60,0.2"],["Borrow {A*0.4} against that~v on {N}, keeping~Dso no liquidation risk appears ","1,6,0.3,30,0.16"],["Swap the borrowed funds into a stable asset and re-supply {A*0.3} to~k for~floop ","2,8,0.12,45,0.16"],["Repay {A*0.2} o~jloan after ~Lto show a full borrow-and-repay cycle ","1,5,0.08,14,0.12"],["Top up the {N}~v by {A*0.2} when the market dips, keeping the~Don {C} ","1,5,0.06,30,0.1"],["Hold~s supply~auntouched~h~ba~q lender~Her ","0,3,0.1,60,0.12"],["Repay the rest o~jloan in full and w~rf the~v, leaving half supplied ","2,6,0.08,60,0.14"]],"RWA":[["Complete the~Uand KYC check on {N} first, before sending any funds, and save the approval screen ","0,15,0,0,0.08"],["Buy {A} of the tokenised asset on~uin one order and~c~treceipt ","1,6,0.3,90,0.22"],["Hold the {N}~afor at least 90 days to match the asset's own term, ~Pyield payout ","0,3,0.3,90,0.18"],["Reinvest~n yield payout~K*0.05}, back into~y{N} asset on {C} ","1,5,0.015,30,0.12"],["Add~f{A*0.5} purchase on~d30 days if~n~ais paying as stated ","1,6,0.15,60,0.14"],["Check the underlying asset documents on {N} each month~Mthe maturity date~Vrecords ","0,10,0,30,0.08"],["Exit~W~aat maturity~i~E,~ba completed full-term cycle ","1,6,0.15,90,0.18"]],"Risk Curators":[["~m a {N} curated vault ~z~c vault share receipt ","1,6,0.3,60,0.2"],["Read the vault's risk parameters on {N} (caps, curator fee, rebalancing rules)~Mthem~I","0,12,0,0,0.08"],["~R~f{N} vault with a~A curator on {C} to spread curator risk ","1,6,0.15,45,0.16"],["~T vault deposits untouched~h~ba~q~l, not a flash deposit ","0,3,0.3,60,0.16"],["Claim~w the vault yield on {N} monthly~K*0.03} each time,~~Bit ","1,5,0.01,30,0.12"],["Test a small~C~d30 days to~c exit path works on {C} ","1,5,0.06,30,0.12"],["Rebalance between the two {N} vaults after 60 days, moving {A*0.2} toward the better-performing curator ","2,8,0.06,60,0.16"]],"Yield":[["~m the highest-yield {N}~o~z~c~areceipt ","1,6,0.3,60,0.2"],["Harvest~n yield on~d~Land compound it back into the same~o","1,5,0.02,14,0.14"],["Split {A*0.5} into~f{N}~oon {C}~btwo live strategies ","1,6,0.15,45,0.16"],["Auto-compound weekly on {N}~h, spending about {M} min a week on claims~ws {PC}","1,5,0.02,60,0.14"],["Move {A*0.3} between {N} strategies once when yields shift,~Mwhy you moved it ","2,8,0.09,30,0.12"],["Keep~Xserve in the {N}~ountouched for the full 60 days as the~q anchor~a","0,3,0.06,60,0.1"],["W~r~jyield~a~eleave half compounding, showing a completed cycle ","1,6,0.15,60,0.14"]],"Basis Trading":[["Open a {A} delta-neutral basis~aon~uand confirm both legs filled ","2,10,0.3,30,0.2"],["Check~Non {N} daily for~n week and log it, so you can prove the basis was actually captured ","0,5,0,7,0.1"],["Roll the {N} basis~aafte~Ointo the next funding window~gclosing it outright ","2,8,0.3,30,0.18"],["~R the {N}~awhen~Nturns in your favour on {C} ","2,8,0.15,30,0.14"],["Hedge the spot leg o~jtrade once a week~ithe hedge ratio near 1:1 ","1,6,0.05,30,0.12"],["Close one third o~jbasis~aafter 45 days and bank the captured funding ","2,8,0.1,45,0.12"],["Close~s~a~erecord the net funding earned versus fees paid ","2,8,0.2,60,0.14"]],"Onchain Capital Allocator":[["Allocate {A} through~k to its flagship~l and~c receipt ","1,6,0.3,60,0.2"],["Read the~l mandate on {N} (what it may and may not buy) before committing~ftranche ","0,12,0,0,0.08"],["Send~f{A*0.5}~l via~d30 days, to a~A~oin~yallocator ","1,6,0.15,30,0.16"],["Track the {N}~l's monthly report and compare its stated return with the~tbalance ","0,10,0,30,0.1"],["Reallocate {A*0.3} inside~d60 days toward the~othat actually delivered ","2,8,0.09,60,0.16"],["Test~Xdemption from~d30 days to~c exit path and its delay on {C} ","1,6,0.06,30,0.12"],["Leave~s~l running for 90 days, then redeem half~ihalf allocated ","1,6,0.15,90,0.18"]],"Chain":[["Bridge {A} to~uwith the protocol's own bridge and confirm arrival before doing anything else ","1,8,0.3,30,0.18"],["Make three small everyday transactions on {N} — a swap, a transfer and a contract call — across three~A days ","3,9,0.06,14,0.16"],["Stake or delegate {A*0.6} ~x~ithe delegation receipt ","1,6,0.18,30,0.18"],["Use one native {N} app each~papp~Fhe chain's ecosystem ","1,6,0.04,28,0.14"],["Provide {A*0.4} of~Gon {N}'s main DEX ~z hold the LP~h ","2,8,0.12,60,0.14"],["Vote in one~tgovernance proposal on {N} if a vote opens,~ithe vote receipt ","1,5,0,7,0.08"],["Unstake~W~a~ebridge half back, leaving the rest active on the chain ","2,8,0.09,60,0.12"]],"CeDeFi":[["Create and verify your {N} account, including any identity check,~Janything ","0,15,0,0,0.08"],["~m~k and~c balance shows in the app and~t","1,6,0.3,60,0.2"],["Earn yield on the {N} deposit fo~O~Ppayout~Vnotes ","0,4,0.3,30,0.14"],["Move {A*0.5} o~jbalance into~fproduct on~yplatform to show breadth ","1,6,0.15,30,0.16"],["Test a~C~d~Lto~c withdrawal delay and fee on {C} ","1,6,0.06,14,0.12"],["Re-deposit the withdrawn {A*0.2} into~dthe test so the net~astays invested ","1,5,0.06,30,0.1"],["W~r~jbalance ~eleave half earning, closing~n full cycle ","1,6,0.15,60,0.2"]],"Generic":[["Connect your wallet to~k and complete any profile or verification step~J","0,10,0,0,0.08"],["~m the main {N} product ~z~c~treceipt ","1,6,0.3,60,0.22"],["Use the {N} product once a~puse,~~Q","1,5,0.04,28,0.16"],["Add~f{A*0.5}~ain a~A {N} feature on {C} afte~O","1,6,0.15,30,0.14"],["Claim any rewards or yield on~dtwo weeks~w them~~B","1,5,0.02,14,0.12"],["Hold the main {N}~auntouched~h~ba~q position~H ","0,3,0.3,60,0.12"],["W~rf the {N}~a~eleave ~E, completing~n full cycle ","1,6,0.15,60,0.16"]]};
const MODS=[["Bridge {A} of your {N}~ato {C2} and use the protocol there once~Fwo of its chains ","2,10,0.1,30,0.05"],["{N}'s TVL fell {G}% in 7 days, so farm with half size — {A*0.5}~g{A} — and watch the exit~I","0,8,0,14,0.04"],["{N} has only run about {AG} days, so expect UI churn and contract upgrades; re-check the app each week before transacting ","0,6,0,7,0.03"],["Re-check {N}'s~Urules before each new deposit, since RWA access depends on your jurisdiction and can change ","0,8,0,7,0.03"]];
const CLOSE=[["Review the {N}~aweekly on {C}: check TVL, fees paid so far and whether the~ais still worth {A} tied up ","0,5,0,60,0.02"],["Remember {N} records no token, so nothing here is guaranteed: only farm with {A} you can afford to leave locked, and never borrow to farm it ","0,3,0,0,0.01"]];
for(const k in PB)PB[k]=PB[k].map(d=>[dec(d[0]),d[1]]);
for(let i=0;i<MODS.length;i++)MODS[i]=[dec(MODS[i][0]),MODS[i][1]];
for(let i=0;i<CLOSE.length;i++)CLOSE[i]=[dec(CLOSE[i][0]),CLOSE[i][1]];

// --- farm plan: [text, tx, manualMin, deployFrac, holdDays, share] ---
function plan(r,Bk){
 const[fee,cfm]=ci(r.chs[0]||"Ethereum");const defs=[...(PB[r.cat]||PB.Generic)];
 if(r.chs.length>1)defs.push(MODS[0]);
 if((r.chg??0)<0)defs.push(MODS[1]);
 if((r.age??9999)<180)defs.push(MODS[2]);
 if(r.cat==="RWA")defs.push(MODS[3]);
 defs.push(...CLOSE);const all=defs.slice(0,12),ss=all.reduce((s,d)=>s+ +d[1].split(",")[4],0);
 let tf=0,to=0,tm=0,te=0;
 const steps=all.map(d=>{const q=d[1].split(","),tx=+q[0],f=Math.round(tx*fee*100)/100,dep=Bk*+q[2],amt=dep>0?Math.round(dep):Math.round(Bk*.1);
  const op=Math.round(dep*.045*(+q[3]/365)*100)/100,mn=tx*cfm+ +q[1],ev=Math.round((r.pool*(+q[4]/ss)-f-op)*100)/100;
  let t=d[0].replace(/\{A(\*[0-9.]+|\/[0-9.]+)?\}/g,(m,x)=>money(!x?amt:x[0]==="/"?amt/+x.slice(1):amt*+x.slice(1))).replace(/\{N\}/g,r.name).replace(/\{C2\}/g,r.chs[1]||r.chs[0]).replace(/\{C\}/g,r.chs[0]||"Ethereum").replace(/\{AG\}/g,String(r.age??"\u2014")).replace(/\{G\}/g,(r.chg??0).toFixed(1)).replace(/\{M\}/g,String(mn)).replace(/\{F\}/g,money(f));
  if(t.indexOf("{PC}")>=0)t=t.replace("{PC}","(about "+money(f)+" in fees per claim, about "+mn+" min active).");
  else t+="(about "+money(f)+" in fees, about "+mn+" min active).";
  tf+=f;to+=op;tm+=mn;te+=ev;return{t,f,op,mn,ev}});
 return{steps,tf:Math.round(tf*100)/100,to:Math.round(to*100)/100,tm,te:Math.round(te*100)/100};
}
const S={f:"all",q:"",k:"rk",d:1,B:2500,det:null,val:false};
let lcSet=new Set();
function lowcost(){const s=rows.map(r=>{const p=plan(r,S.B);return{s:r.slug,v:p.tf>0?p.te/p.tf:-1e9}}).sort((a,b)=>b.v-a.v).slice(0,40);lcSet=new Set(s.map(x=>x.s));$("lcN").textContent="("+lcSet.size+")"}
function kpis(){const ivs=rows.map(r=>r.iv).sort((a,b)=>a-b),pool=rows.reduce((s,r)=>s+r.pool,0);
 $("kpis").innerHTML=[["342","board rows \u00b7 pre-token"],["40/40","watchlist coverage"],[f$(ivs[171]),"median IV P50"],[f$(pool),"total modelled pool"],["P50 \u00b7 OLS+EB","5-fold CV \u00b7 OOS R\u00b2 "+D.cv.r2]].map(k=>'<div class="kp"><b>'+k[0]+'</b><span>'+k[1]+'</span></div>').join("")}
const ACC={rk:r=>r.rk,name:r=>r.name.toLowerCase(),cat:r=>r.cat,tvl:r=>r.tvl,chg:r=>r.chg??-999,age:r=>r.age??-1,iv:r=>r.iv,pool:r=>r.pool,w:r=>r.w,ev:r=>plan(r,S.B).te};
function filtered(){let a=rows;
 if(S.f==="watchlist")a=a.filter(r=>r.wl);
 if(S.f==="lowcost")a=a.filter(r=>lcSet.has(r.slug));
 if(S.q)a=a.filter(r=>(r.slug+" "+r.name.toLowerCase()).includes(S.q));
 const k=ACC[S.k]||ACC.rk;return[...a].sort((x,y)=>{const u=k(x),v=k(y);return(u<v?-1:u>v?1:0)*S.d})}
function board(){const a=filtered();$("rc").textContent=a.length+" rows \u00b7 click a row for detail \u00b7 click a header to sort";
 $("tb").innerHTML=a.map(r=>{const p=plan(r,S.B),ch=r.chg==null?"\u2014":(r.chg>0?"+":"")+r.chg.toFixed(1)+"%";
  const cc=r.chg==null?"":r.chg>=0?"pos":"neg";
  return'<tr data-s="'+r.slug+'"><td>'+r.rk+'</td><td>'+esc(r.name)+(r.wl?'<span class="bdg">WATCHLIST</span>':"")+'<br><span style="color:#8A94A6">'+r.slug+'</span></td><td>'+esc(r.cat)+'</td><td title="'+esc(r.chs.join(", "))+'">'+esc(r.chs.slice(0,2).join(", "))+(r.chs.length>2?" +"+(r.chs.length-2):"")+'</td><td class="num">'+f$(r.tvl)+'</td><td class="'+cc+'">'+ch+'</td><td>'+(r.age==null?"\u2014":r.age+"d")+'</td><td class="amb">'+f$(r.iv)+'</td><td>'+f$(r.p15)+"\u2013"+f$(r.p85)+'</td><td>'+f$(r.pool)+'</td><td>'+r.w.toFixed(2)+'</td><td class="'+(p.te>=0?"pos":"neg")+'">'+(p.te>=0?"+":"\u2212")+f$(Math.abs(p.te))+'</td></tr>'}).join("");
 document.querySelectorAll("th[data-k]").forEach(th=>{th.textContent=th.textContent.replace(/ [\u25B2\u25BC]$/,"");if(th.dataset.k===S.k)th.textContent+=" "+(S.d>0?"\u25B2":"\u25BC")})}
function regSVG(){const pts=[];for(const i in mm){const tv=B36(T[i])*1000;if(tv>0)pts.push([Math.log(tv),Math.log(mm[i])])}
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const b0=D.beta[0]+D.beta[2]*Math.asinh(medChg/10)+D.beta[3]*Math.log(1+medAge)+D.beta[4]*Math.log(2),b1=D.beta[1];
 const det=S.det?bySlug[S.det]:null;
 let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 if(det){x0=Math.min(x0,Math.log(det.tvl));x1=Math.max(x1,Math.log(det.tvl));y0=Math.min(y0,Math.log(det.iv));y1=Math.max(y1,Math.log(det.iv))}
 const W=560,H=300,Pd=36,X=v=>Pd+(v-x0)/(x1-x0)*(W-2*Pd),Y=v=>H-Pd-(v-y0)/(y1-y0)*(H-2*Pd);
 const L=v=>b0+b1*v,lnS=Math.log(D.smear);
 const ln=v=>{const e=Math.exp(v);return e>=1e9?"$"+(e/1e9).toFixed(1)+"B":e>=1e6?"$"+(e/1e6).toFixed(0)+"M":"$"+(e/1e3).toFixed(0)+"k"};
 let s='<svg viewBox="0 0 560 300" role="img" aria-label="Regression scatter"><rect width="560" height="300" fill="#080A0F"/>';
 s+='<polygon points="'+X(x0)+","+Y(L(x0)+D.q85+lnS)+" "+X(x1)+","+Y(L(x1)+D.q85+lnS)+" "+X(x1)+","+Y(L(x1)+D.q15+lnS)+" "+X(x0)+","+Y(L(x0)+D.q15+lnS)+'" fill="#F59E0B" opacity="0.12"/>';
 s+='<line x1="'+X(x0)+'" y1="'+Y(L(x0)+D.q85+lnS)+'" x2="'+X(x1)+'" y2="'+Y(L(x1)+D.q85+lnS)+'" stroke="#F59E0B" stroke-dasharray="4 3" opacity="0.6"/><line x1="'+X(x0)+'" y1="'+Y(L(x0)+D.q15+lnS)+'" x2="'+X(x1)+'" y2="'+Y(L(x1)+D.q15+lnS)+'" stroke="#F59E0B" stroke-dasharray="4 3" opacity="0.6"/>';
 s+='<line x1="'+X(x0)+'" y1="'+Y(L(x0))+'" x2="'+X(x1)+'" y2="'+Y(L(x1))+'" stroke="#F59E0B" stroke-width="2"/>';
 pts.forEach(p=>{s+='<circle cx="'+X(p[0]).toFixed(1)+'" cy="'+Y(p[1]).toFixed(1)+'" r="2.2" fill="#38BDF8" opacity="0.75"/>'});
 if(det)s+='<rect x="'+(X(Math.log(det.tvl))-5)+'" y="'+(Y(Math.log(det.iv))-5)+'" width="10" height="10" fill="#F59E0B" transform="rotate(45 '+X(Math.log(det.tvl))+" "+Y(Math.log(det.iv))+')"/><text x="'+(X(Math.log(det.tvl))+10)+'" y="'+(Y(Math.log(det.iv))-8)+'" fill="#F59E0B" font-size="11">'+esc(det.name)+'</text>';
 [0,.33,.66,1].forEach(f=>{const xv=x0+(x1-x0)*f,yv=y0+(y1-y0)*f;
  s+='<text x="'+X(xv)+'" y="292" fill="#8A94A6" font-size="10" text-anchor="middle">'+ln(xv)+'</text><text x="4" y="'+(Y(yv)+3)+'" fill="#8A94A6" font-size="10">'+ln(yv)+'</text>'});
 s+='<text x="280" y="14" fill="#8A94A6" font-size="11" text-anchor="middle">ln(TVL) \u2192 ln(Mcap) \u00b7 n='+pts.length+' \u00b7 amber = fitted P50, dashed = P15/P85</text></svg>';
 return s}
function wfSVG(r){const b=D.beta,lt=Math.log(r.tvl),x2=Math.asinh((r.chg??medChg)/10),la=Math.log(1+(r.age??medAge)),lc=Math.log(1+r.chs.length);
 const terms=[["Intercept",b[0]],["ln TVL",b[1]*lt],["Growth",b[2]*x2],["Age",b[3]*la],["Chains",b[4]*lc]];
 const sum=terms.reduce((s,t)=>s+t[1],0),cat=Math.log(r.iv)-sum;terms.push(["Category",cat]);
 const tot=Math.log(r.iv),W=560,H=210,Pd=30,BW=64;
 const mn=Math.min(0,...terms.map(t=>t[1])),mx=Math.max(tot,...terms.map(t=>t[1]));
 const Y=v=>H-Pd-(v-mn)/(mx-mn)*(H-2*Pd);
 let s='<svg width="560" height="210" viewBox="0 0 560 210" role="img" aria-label="IV waterfall"><rect width="560" height="210" fill="#080A0F"/>';
 s+='<line x1="'+Pd+'" y1="'+Y(0)+'" x2="'+(W-10)+'" y2="'+Y(0)+'" stroke="#1E2532"/>';
 terms.forEach((t,j)=>{const x=Pd+8+j*86,h=Math.abs(Y(t[1])-Y(0));
  s+='<rect x="'+x+'" y="'+Math.min(Y(t[1]),Y(0))+'" width="'+BW+'" height="'+Math.max(h,1.5)+'" fill="'+(t[1]>=0?"#38BDF8":"#F43F5E")+'"/>';
  s+='<text x="'+(x+BW/2)+'" y="'+(H-12)+'" fill="#8A94A6" font-size="10" text-anchor="middle">'+t[0]+'</text>';
  s+='<text x="'+(x+BW/2)+'" y="'+(Math.min(Y(t[1]),Y(0))-4)+'" fill="#E6EAF2" font-size="10" text-anchor="middle">'+t[1].toFixed(2)+'</text>'});
 s+='<line x1="'+Pd+'" y1="'+Y(tot)+'" x2="'+(W-10)+'" y2="'+Y(tot)+'" stroke="#F59E0B" stroke-dasharray="5 3"/><text x="'+(W-12)+'" y="'+(Y(tot)-5)+'" fill="#F59E0B" font-size="10" text-anchor="end">ln IV = '+tot.toFixed(2)+'</text></svg>';
 return s}
function cvHTML(){const c=D.cv,b=D.bench,sm=D.cvSmear;
 const row=(n,r2,rho,md,cov,note)=>'<tr><td>'+n+'</td><td>'+r2.toFixed(4)+'</td><td>'+(rho==null?"\u2014":rho.toFixed(4))+'</td><td>'+md.toFixed(4)+'</td><td>'+(cov==null?"\u2014":cov.toFixed(4))+'</td><td>'+(note||"")+'</td></tr>';
 return'<table><thead><tr><th>Model</th><th>OOS R\u00b2</th><th>Spearman \u03c1</th><th>MdAPE</th><th>P15\u2013P85</th><th>Note</th></tr></thead><tbody>'
 +row("Full model (P50)",c.r2,c.rho,c.mdape,c.cov,"<span class='pos'>board IV</span>")
 +row("Category median",b.cat.r2,null,b.cat.mdape,null,"")
 +row("Simple log-log",b.log.r2,null,b.log.mdape,null,"")
 +row("Smeared mean",sm.r2,sm.rho,sm.mdape,sm.cov,"<span class='neg'>REJECTED</span>")
 +'</tbody></table><p class="nt">\u03b2 = ['+D.beta.map(x=>x.toFixed(4)).join(", ")+'] &middot; fit N='+D.fitN+' &middot; in-sample R\u00b2 '+D.inR2.toFixed(4)+' &middot; Duan smear '+D.smear.toFixed(4)+'. Smeared mean rejected (MdAPE 5.5009 vs 0.894); board uses P50 median.</p>'}
function detail(r){const p=plan(r,S.B);
 const band='<div class="band"><span>P15 '+f$(r.p15)+'</span><div class="tr"><div class="fl"></div><div class="mk" style="left:'+(100*(Math.log(r.iv)-Math.log(r.p15))/(Math.log(r.p85)-Math.log(r.p15)))+'%"></div></div><span>P85 '+f$(r.p85)+'</span></div>';
 let h='<div class="dh"><h2>'+esc(r.name)+'</h2><span class="cyn">'+r.slug+'</span>'+(r.wl?'<span class="bdg">WATCHLIST</span>':"")+'<span style="color:#8A94A6">records no token</span></div>';
 h+='<div class="dgrid">'+[["IV P50",f$(r.iv)],["Modelled pool",f$(r.pool)],["Readiness W",r.w.toFixed(3)],["TVL",f$(r.tvl)],["7d change",r.chg==null?"\u2014":r.chg.toFixed(1)+"%"],["Age",r.age==null?"\u2014":r.age+" days"],["Category",esc(r.cat)],["Chains",r.chs.length+" \u00b7 "+esc(r.chs.slice(0,2).join(", "))+(r.chs.length>2?" +"+(r.chs.length-2):"")]].map(k=>'<div class="dg"><b>'+k[1]+'</b><span>'+k[0]+'</span></div>').join("")+'</div>';
 h+=band+'<h2>IV waterfall &middot; log contributions</h2>'+wfSVG(r);
 h+='<h2 style="margin-top:8px">Farm plan &middot; bankroll '+money(S.B)+' &middot; '+p.steps.length+' steps</h2><table class="plan"><thead><tr><th>#</th><th>Step</th><th>Fee</th><th>Opp. cost</th><th>Min</th><th>EV</th></tr></thead><tbody>'
 +p.steps.map((s,j)=>'<tr><td>'+(j+1)+'</td><td>'+esc(s.t)+'</td><td>'+money(s.f)+'</td><td>'+money(s.op)+'</td><td>'+s.mn+'</td><td class="'+(s.ev>=0?"pos":"neg")+'">'+(s.ev>=0?"+":"\u2212")+money(Math.abs(s.ev))+'</td></tr>').join("")
 +'<tr class="tot"><td></td><td>Total</td><td>'+money(p.tf)+'</td><td>'+money(p.to)+'</td><td>'+p.tm+'</td><td class="'+(p.te>=0?"pos":"neg")+'">'+(p.te>=0?"+":"\u2212")+money(Math.abs(p.te))+'</td></tr></tbody></table>'
 +'<p class="nt">Pool = IV \u00d7 7% \u00d7 (0.5+0.5W). Fees fixed per chain; opportunity cost 4.5%/yr on deployed capital; EV = pool share \u2212 fee \u2212 opp. cost. Records no token \u2014 nothing guaranteed.</p>';
 return h}
function render(){
 document.querySelector(".bk").hidden=!S.det;
 document.querySelectorAll("#chips button").forEach(b=>b.classList.toggle("on",(S.f==="all"&&b.dataset.f==="all")||b.dataset.f===S.f||(S.val&&b.dataset.f==="validation")));
 document.querySelectorAll("#br button").forEach(b=>b.classList.toggle("on",+b.dataset.b===S.B));
 $("cvPn").classList.toggle("val",S.val);
 $("bt").textContent=S.det?"Protocol detail":S.f==="watchlist"?"Watchlist 40/40":S.f==="lowcost"?"Low-Cost High-EV":S.val?"Ranked board \u00b7 validation view":"Ranked board";
 if(S.det){const r=bySlug[S.det];
  if(r){$("tbl").style.display="none";$("det").hidden=false;$("det").innerHTML=detail(r);$("rc").textContent="rank #"+r.rk+" of 342"}
  else{$("tbl").style.display="";$("det").hidden=true;$("det").innerHTML="";board()}
 }else{$("tbl").style.display="";$("det").hidden=true;$("det").innerHTML="";board()}
 $("reg").innerHTML=regSVG();$("cv").innerHTML=cvHTML();
}
function route(){const h=location.hash;S.det=null;S.val=false;
 if(h.indexOf("#detail=")===0){S.det=decodeURIComponent(h.slice(8));S.f="all"}
 else if(h==="#filter=lowcost")S.f="lowcost";
 else if(h==="#filter=watchlist")S.f="watchlist";
 else if(h==="#view=validation"){S.f="all";S.val=true}
 else S.f="all";
 render()}
$("q").addEventListener("input",e=>{S.q=e.target.value.trim().toLowerCase();if(!S.det)board()});
$("chips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
 location.hash=b.dataset.f==="all"?"#/":b.dataset.f==="validation"?"#view=validation":"#filter="+b.dataset.f});
$("br").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;S.B=+b.dataset.b;lowcost();render()});
$("tbl").addEventListener("click",e=>{const th=e.target.closest("th[data-k]");
 if(th){const k=th.dataset.k;if(S.k===k)S.d*=-1;else{S.k=k;S.d=k==="name"||k==="cat"?1:-1}board();return}
 const tr=e.target.closest("tr[data-s]");if(tr)location.hash="#detail="+tr.dataset.s});
window.addEventListener("hashchange",route);
kpis();lowcost();route();
