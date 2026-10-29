export class Plotter {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.offset=[0,0];this.pan=null;
    canvas.addEventListener('pointerdown',e=>{this.pan=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener('pointermove',e=>{if(!this.pan)return;this.offset[0]-=(e.clientX-this.pan[0])/this.scale;this.offset[1]+=(e.clientY-this.pan[1])/this.scale;this.pan=[e.clientX,e.clientY]});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>this.pan=null);
  }
  center(p){this.offset=p.slice()}
  draw(paths,selected,scale=1300){
    this.scale=scale;const canvas=this.canvas,ctx=this.ctx,r=canvas.getBoundingClientRect(),dpr=Math.min(2.5,devicePixelRatio||1),w=r.width,h=r.height;
    if(!(w>0&&h>0))return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#0b1724';ctx.fillRect(0,0,w,h);
    const X=x=>w/2+(x-this.offset[0])*scale,Y=y=>h/2-(y-this.offset[1])*scale;
    const step=.05;ctx.strokeStyle='#243b51';ctx.lineWidth=1;
    for(let x=Math.ceil((this.offset[0]-w/2/scale)/step)*step;x<this.offset[0]+w/2/scale;x+=step){ctx.beginPath();ctx.moveTo(X(x),0);ctx.lineTo(X(x),h);ctx.stroke()}
    for(let y=Math.ceil((this.offset[1]-h/2/scale)/step)*step;y<this.offset[1]+h/2/scale;y+=step){ctx.beginPath();ctx.moveTo(0,Y(y));ctx.lineTo(w,Y(y));ctx.stroke()}
    ctx.strokeStyle='#54728a';ctx.beginPath();ctx.moveTo(X(0),0);ctx.lineTo(X(0),h);ctx.moveTo(0,Y(0));ctx.lineTo(w,Y(0));ctx.stroke();
    const colors={estimated:'#5ee1be',native:'#86b9ff',fixed:'#f4b876'};
    for(const [source,points] of Object.entries(paths)){
      if(points.length<2)continue;ctx.strokeStyle=colors[source];ctx.globalAlpha=selected===source?1:.35;ctx.lineWidth=selected===source?2.5:1.3;ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.stroke();ctx.globalAlpha=1;
    }
    const point=paths[selected]?.at(-1);if(point){ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(X(point[0])-8,Y(point[1]));ctx.lineTo(X(point[0])+8,Y(point[1]));ctx.moveTo(X(point[0]),Y(point[1])-8);ctx.lineTo(X(point[0]),Y(point[1])+8);ctx.stroke()}
    ctx.fillStyle='#c3d5e0';ctx.font='12px system-ui';ctx.fillText('格子：5 cm',10,h-12);
  }
}
export class SeriesPlot {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d')}
  draw(rows,{source='estimated',quantity='acceleration',axis='x',windowSec=12}={}){
    const c=this.canvas,ctx=this.ctx,r=c.getBoundingClientRect(),w=r.width,h=r.height;if(!(w>0&&h>0))return;
    const dpr=Math.min(2.5,devicePixelRatio||1);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#0b1724';ctx.fillRect(0,0,w,h);const end=rows.at(-1)?.t??0,start=end-windowSec*1000;
    const relevant=rows.filter(r=>r.t>=start),ix=axis==='x'?0:axis==='y'?1:2;
    const pick=r=>{
      if(quantity==='raw')return r.raw?.[ix];
      if(quantity==='gravity')return r.gravityBody?.[ix];
      if(quantity==='residual')return r.osEstimatedResidual?.[ix];
      if(quantity==='velocity')return r.tracks?.[source]?.free?.v[ix];
      if(quantity==='constrainedVelocity')return r.tracks?.[source]?.constrained?.v[ix];
      if(quantity==='position')return r.tracks?.[source]?.constrained?.x[ix];
      return r.aWorld?.[source]?.[ix];
    };
    const series=relevant.map(r=>({t:r.t,y:pick(r)})).filter(p=>Number.isFinite(p.y));
    if(series.length===0){ctx.fillStyle='#8ca0b3';ctx.font='13px system-ui';ctx.fillText('測定を開始するとグラフが表示されます',20,h/2);return}
    let min=Math.min(0,...series.map(p=>p.y)),max=Math.max(0,...series.map(p=>p.y));if(max-min<.01){min-=.05;max+=.05}const pad=(max-min)*.12;min-=pad;max+=pad;
    const L=57,R=w-15,T=17,B=h-30,X=t=>L+(t-start)/(Math.max(1,end-start))*(R-L),Y=y=>B-(y-min)/(max-min)*(B-T);
    ctx.strokeStyle='#283d50';ctx.lineWidth=1;for(let i=0;i<=4;i++){const y=T+(B-T)*i/4;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.fillStyle='#a9bfce';ctx.font='11px system-ui';ctx.fillText((max-(max-min)*i/4).toFixed(2),5,y+4)}
    ctx.strokeStyle='#54728a';ctx.beginPath();ctx.moveTo(L,Y(0));ctx.lineTo(R,Y(0));ctx.stroke();
    ctx.strokeStyle='#6ae1be';ctx.lineWidth=2;ctx.beginPath();let prev=null;for(const p of series){if(!prev||p.t-prev.t>140)ctx.moveTo(X(p.t),Y(p.y));else ctx.lineTo(X(p.t),Y(p.y));prev=p}ctx.stroke();
    ctx.fillStyle='#a9bfce';ctx.fillText(`${(windowSec).toFixed(0)}秒 / ${axis.toUpperCase()}軸`,L,h-8);
  }
}
