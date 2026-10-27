import {flattenComparison} from './comparison.js';
const modes=['fixed','dynamic','os'];const colors={fixed:'#e3a45b',dynamic:'#7bd9b1',os:'#9bbcff'};
export function createComparisonUI(comparison){
 const section=document.getElementById('gravityComparison');
 const select=id=>document.getElementById(id);
 const chart=select('comparisonCanvas'),ctx=chart.getContext('2d');
 const draw=()=>{
  const rows=comparison.rows,axis=select('compareAxis').value,kind=select('compareQuantity').value,frame=select('compareFrame').value,windowSize=select('compareWindow').value;
  const end=rows.at(-1)?.t??0,start=windowSize==='all'?rows[0]?.t??0:end-Number(windowSize)*1000;
  const subset=rows.filter(r=>r.t>=start);const dpr=window.devicePixelRatio||1,w=Math.max(280,chart.clientWidth),h=260;chart.width=w*dpr;chart.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#101c2b';ctx.fillRect(0,0,w,h);
  const left=48,right=w-14,top=12,bottom=h-30;
  const get=(r,m)=>{if(kind==='raw')return r.raw?.[axis];if(kind==='gravity')return r.gravity[m]?.[axis];if(kind==='device')return r.device[m]?.[axis];if(kind==='initial')return r.initial[m]?.[axis];return r.results[`${m}_${frame}`]?.[kind==='velocity'?'v':'x']?.[axis]};
  const ys=subset.flatMap(r=>modes.map(m=>get(r,m)).filter(Number.isFinite));let min=Math.min(0,...ys),max=Math.max(0,...ys);if(max-min<1e-6){min-=.5;max+=.5}const pad=(max-min)*.1;min-=pad;max+=pad;
  const tx=t=>left+(t-start)/(Math.max(1,end-start))*(right-left),ty=v=>bottom-(v-min)/(max-min)*(bottom-top);
  ctx.strokeStyle='#55677c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,ty(0));ctx.lineTo(right,ty(0));ctx.stroke();
  ctx.fillStyle='#becddd';ctx.font='12px sans-serif';ctx.fillText(max.toFixed(2),3,top+8);ctx.fillText('0',15,ty(0)-3);ctx.fillText(min.toFixed(2),3,bottom);ctx.fillText(`${((end-start)/1000).toFixed(1)} s`,right-36,h-7);
  for(const m of modes){ctx.strokeStyle=colors[m];ctx.lineWidth=1.6;ctx.beginPath();let open=false;for(const r of subset){const v=get(r,m);if(!Number.isFinite(v)){open=false;continue}if(!open)ctx.moveTo(tx(r.t),ty(v));else ctx.lineTo(tx(r.t),ty(v));open=true}ctx.stroke()}
  select('compareSummary').textContent=rows.length?`記録 ${rows.length} サンプル ／ ${modes.map(m=>{const r=rows.at(-1).results[`${m}_${frame}`];return `${m}: ${r?`v=${(r.v[axis]).toFixed(3)} m/s, x=${r.x[axis].toFixed(3)} m`:'欠測'}`}).join(' ｜ ')}`:'補正完了後、3方式を記録します。';
 };
 const controls=['compareAxis','compareQuantity','compareFrame','compareWindow'];controls.forEach(id=>select(id).addEventListener('change',draw));
 select('compareJson').onclick=()=>save(JSON.stringify({schema:'gravity-comparison/1',units:{t:'ms',a:'m/s²',v:'m/s',x:'m',gyro:'rad/s'},reference:comparison.reference,rows:comparison.rows},null,2),'comparison.json','application/json');
 select('compareCsv').onclick=()=>{const rows=comparison.rows.map(flattenComparison);if(!rows.length)return;const keys=[...new Set(rows.flatMap(Object.keys))];const cell=v=>v==null?'':`"${String(v).replaceAll('"','""')}"`;save('\ufeff'+keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\r\n'),'comparison.csv','text/csv')};
 function save(body,name,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return {draw};
}
