// No damping, dynamic scale, smoothing or dead zone. Each source is independent.
// A zero-velocity update only affects the explicitly constrained channel.
export class Integrator2D {
  constructor(){this.reset()}
  reset(){this.t=null;this.prevA=null;this.v=[0,0];this.x=[0,0];this.gaps=0;this.resets=0}
  step(t,a,zeroVelocity=false){
    if(!Number.isFinite(t)||!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite))return {accepted:false,reason:'invalid'};
    if(this.t===null){this.t=t;this.prevA=a.slice();if(zeroVelocity){this.v=[0,0];this.resets++}return {accepted:true,dt:0}}
    const dt=(t-this.t)/1000,prev=this.prevA;this.t=t;this.prevA=a.slice();
    if(!(dt>0)||dt>.12){this.gaps++;return {accepted:false,reason:'time_gap',dt}}
    if(zeroVelocity){this.v=[0,0];this.resets++;return {accepted:true,dt,zupt:true}}
    const vNew=this.v.map((v,i)=>v+(prev[i]+a[i])*.5*dt);
    this.x=this.x.map((x,i)=>x+(this.v[i]+vNew[i])*.5*dt);
    this.v=vNew;return {accepted:true,dt,zupt:false};
  }
  snapshot(){return {x:this.x.slice(),v:this.v.slice(),gaps:this.gaps,resets:this.resets}}
}
export class TrackPair {
  constructor(){this.free=new Integrator2D();this.constrained=new Integrator2D()}
  reset(){this.free.reset();this.constrained.reset()}
  step(t,a,restCandidate){return {free:this.free.step(t,a,false),constrained:this.constrained.step(t,a,restCandidate)}}
}
// Retroactive zero-end-velocity correction on a DELIBERATELY MARKED segment.
// Assumes v(start)=v(end)=0 and an approximately CONSTANT acceleration offset.
export function correctRestToRest(samples){
  if(samples.length<3)throw Error('区間のサンプルが不足しています');
  let T=0,integral=[0,0];
  for(let i=1;i<samples.length;i++){
    const dt=(samples[i].t-samples[i-1].t)/1000;
    if(!(dt>0)||dt>.12)throw Error('区間内に時刻の欠落があります');
    T+=dt;
    for(let k=0;k<2;k++)integral[k]+=(samples[i-1].a[k]+samples[i].a[k])*.5*dt;
  }
  if(T<.2)throw Error('区間が短すぎます');
  const bias=integral.map(x=>x/T);
  let vel=[0,0],pos=[0,0];
  for(let i=1;i<samples.length;i++){
    const dt=(samples[i].t-samples[i-1].t)/1000;
    const next=vel.map((v,k)=>v+((samples[i-1].a[k]+samples[i].a[k])*.5-bias[k])*dt);
    pos=pos.map((x,k)=>x+(vel[k]+next[k])*.5*dt);vel=next;
  }
  return {seconds:T,bias,displacement:pos,terminalVelocity:vel,rawTerminalVelocity:integral};
}
