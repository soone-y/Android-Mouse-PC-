export class Plotter{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cam=[0,0];this.pan=null;canvas.addEventListener('pointerdown',e=>{this.pan={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!this.pan)return;const scale=this.scale||2500;this.cam[0]-=(e.clientX-this.pan.x)/scale;this.cam[1]-=(e.clientY-this.pan.y)/scale;this.pan={x:e.clientX,y:e.clientY}});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>this.pan=null)}
 center(p){this.cam=p.slice()}
 draw(main,comparison=[],scale=2500,flipY=true){this.scale=scale;const canvas=this.canvas,ctx=this.ctx,box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2.5),w=Math.max(1,box.width),h=Math.max(1,box.height);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#06182a';ctx.fillRect(0,0,w,h);
 const inv=flipY?-1:1,worldX=x=>w/2+(x-this.cam[0])*scale,worldY=y=>h/2+inv*(y-this.cam[1])*scale;
 const p=main.at(-1)||[0,0];if(!this.pan){const px=worldX(p[0]),py=worldY(p[1]);const dx=px-w/2,dy=py-h/2;if(Math.abs(dx)>w*.25)this.cam[0]+=(dx-Math.sign(dx)*w*.25)/scale;if(Math.abs(dy)>h*.25)this.cam[1]+=(dy-Math.sign(dy)*h*.25)/(scale*inv)}
 let step=.01;while(step*scale<11)step*=2;while(step*scale>70)step/=2;
 const left=this.cam[0]-w/(2*scale),right=this.cam[0]+w/(2*scale),bottom=this.cam[1]-h/(2*scale),top=this.cam[1]+h/(2*scale);
 for(let xi=Math.ceil(left/step);xi<=Math.floor(right/step);xi++)for(let yi=Math.ceil(bottom/step);yi<=Math.floor(top/step);yi++){const x=xi*step,y=yi*step;const major=Math.abs(x/.1-Math.round(x/.1))<1e-5&&Math.abs(y/.1-Math.round(y/.1))<1e-5;ctx.fillStyle=major?'#4b7194':'#213c54';ctx.beginPath();ctx.arc(worldX(x),worldY(y),major?1.8:.8,0,Math.PI*2);ctx.fill()}
 ctx.lineWidth=1;ctx.strokeStyle='#426482';ctx.beginPath();ctx.moveTo(worldX(0),0);ctx.lineTo(worldX(0),h);ctx.moveTo(0,worldY(0));ctx.lineTo(w,worldY(0));ctx.stroke();
 const trace=(rows,color,width=1.8)=>{if(rows.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();rows.forEach((v,i)=>i?ctx.lineTo(worldX(v[0]),worldY(v[1])):ctx.moveTo(worldX(v[0]),worldY(v[1])));ctx.stroke()};
 for(const c of comparison)trace(c,'#e0a57190',1.4);trace(main,'#63e2c3',2.5);
 ctx.fillStyle='#e7aa6b';ctx.beginPath();ctx.arc(worldX(0),worldY(0),3.5,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText('原点',worldX(0)+7,worldY(0)-7);
 const x=worldX(p[0]),y=worldY(p[1]);ctx.strokeStyle='#dcfff6';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
 }
}
