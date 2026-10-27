const colorX='#55dbc8',colorY='#f6b86a',shadowX='#44887c',shadowY='#956b46';
const fmt=(n)=>Math.abs(n)>=100?n.toFixed(0):Math.abs(n)>=10?n.toFixed(1):n.toFixed(2);
function tickStep(span){if(!(span>0))return 1;const rough=span/4,p=Math.pow(10,Math.floor(Math.log10(rough)));return [1,2,2.5,5,10].map(k=>k*p).find(k=>k>=rough)||10*p}
export class TimeChart{
 constructor(canvas,{title,unit,key}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.title=title;this.unit=unit;this.key=key;this.data=null;this.hover=null;
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();this.hover=e.clientX-r.left;this.draw()});
  canvas.addEventListener('pointerleave',()=>{this.hover=null;this.draw()});
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();this.hover=e.clientX-r.left;this.draw()});
 }
 setData(data){this.data=data;this.draw()}
 draw(){
  const {canvas,ctx}=this;const bounds=canvas.getBoundingClientRect();const w=bounds.width,h=bounds.height;if(w<1||h<1)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#081929';ctx.fillRect(0,0,w,h);
  const left=52,right=w-14,top=20,bottom=h-34,plotW=Math.max(1,right-left),plotH=Math.max(1,bottom-top);
  const data=this.data;if(!data||!data.rows){ctx.fillStyle='#8fa9bc';ctx.textAlign='center';ctx.font='13px system-ui';ctx.fillText('センサー開始・模擬入力・CSV再生で表示',w/2,h/2);return}
  const curves=this.key==='acc'?[data.acc]:[data.velocity,data.comparison];
  const valid=curves.flat().filter(p=>p&&Number.isFinite(p.y));
  let min=valid.length?Math.min(...valid.map(v=>v.y),0):-1,max=valid.length?Math.max(...valid.map(v=>v.y),0):1;
  if(max-min<0.1){min-=0.25;max+=0.25}
  const pad=(max-min)*.09;min-=pad;max+=pad;
  const yStep=tickStep(max-min);const minTick=Math.ceil(min/yStep)*yStep;
  const t0=data.first,t1=Math.max(data.end,t0+0.1);const X=t=>left+(t-t0)/(t1-t0)*plotW,Y=v=>bottom-(v-min)/(max-min)*plotH;
  ctx.save();ctx.beginPath();ctx.rect(left,top,plotW,plotH);ctx.clip();
  for(let tick=minTick;tick<=max+1e-8;tick+=yStep){const y=Y(tick);ctx.strokeStyle=Math.abs(tick)<yStep*.001?'#486c80':'#253c50';ctx.lineWidth=Math.abs(tick)<yStep*.001?1.3:1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()}
  const step=tickStep(t1-t0);for(let k=Math.ceil(t0/step)*step;k<=t1+1e-6;k+=step){ctx.strokeStyle='#233a4d';ctx.beginPath();ctx.moveTo(X(k),top);ctx.lineTo(X(k),bottom);ctx.stroke()}
  const drawSeries=(values,dashed,alpha)=>{
   if(!values?.length)return;
   for(const axis of data.axes){const subset=values.filter(p=>p.axis===axis);ctx.beginPath();ctx.strokeStyle=dashed?(axis===0?shadowX:shadowY):(axis===0?colorX:colorY);ctx.lineWidth=dashed?1.3:2;ctx.globalAlpha=alpha;ctx.setLineDash(dashed?[5,5]:[]);
    let prev=null;for(const p of subset){if(!Number.isFinite(p.y)){prev=null;continue}if(prev&&p.t-prev.t>.35)prev=null;const x=X(p.t),y=Y(p.y);if(!prev)ctx.moveTo(x,y);else ctx.lineTo(x,y);prev=p}ctx.stroke();
   }
  };
  if(this.key==='velocity')drawSeries(data.comparison,true,.85);
  drawSeries(this.key==='acc'?data.acc:data.velocity,false,1);
  ctx.setLineDash([]);ctx.globalAlpha=1;
  if(this.hover!==null&&this.hover>=left&&this.hover<=right){const t=t0+(this.hover-left)/plotW*(t1-t0);ctx.strokeStyle='#e8f0f6';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(this.hover,top);ctx.lineTo(this.hover,bottom);ctx.stroke();ctx.setLineDash([]);
   const source=this.key==='acc'?data.acc:data.velocity;let nearest=null,best=Infinity;for(const p of source){if(!Number.isFinite(p.y))continue;const diff=Math.abs(p.t-t);if(diff<best){best=diff;nearest=p}}if(nearest){ctx.fillStyle='#eaf5fc';ctx.font='11px system-ui';const label=`t ${nearest.t.toFixed(2)}s  ${nearest.axis===0?'X':'Y'} ${fmt(nearest.y)} ${this.unit}`;const tw=ctx.measureText(label).width;let tx=Math.min(w-tw-14,Math.max(left+5,this.hover+10));ctx.fillStyle='#122f41';ctx.fillRect(tx-5,top+4,tw+10,23);ctx.fillStyle='#eaf5fc';ctx.fillText(label,tx,top+20)}}
  ctx.restore();ctx.font='11px system-ui';ctx.fillStyle='#abc1d0';ctx.textAlign='right';for(let tick=minTick;tick<=max+1e-8;tick+=yStep){const y=Y(tick);if(y>=top-2&&y<=bottom+2)ctx.fillText(fmt(tick),left-7,y+4)}
  ctx.textAlign='center';const stepX=tickStep(t1-t0);for(let t=Math.ceil(t0/stepX)*stepX;t<=t1+1e-6;t+=stepX)ctx.fillText(fmt(t)+'s',X(t),h-12);
  ctx.textAlign='left';ctx.fillStyle='#b6d0db';ctx.fillText(this.title+' ('+this.unit+')',left+6,13);
 }
}
