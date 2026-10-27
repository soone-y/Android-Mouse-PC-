/** Integrates signed m/s² in a fixed 2D frame. Coordinates m, velocities m/s.
 * No smoothing, friction, gain, dead-zone or post-processing.
 * On missing timestamps, do not invent motion or silently assert zero velocity.
 */
export class InertialIntegrator{
 constructor({maxDt=.1}={}){this.maxDt=maxDt;this.reset()}
 reset(){this.t=null;this.a=null;this.v=[0,0];this.x=[0,0];this.gaps=0}
 update(t,a,stationary=false){
  if(!Number.isFinite(t)||!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite))return {accepted:false,reason:'invalid'};
  const prevT=this.t,prevA=this.a;this.t=t;this.a=a.slice();
  if(prevT===null)return {accepted:true,dt:0,delta:[0,0],dv:[0,0],zupt:false};
  const dt=(t-prevT)/1000;
  if(!(dt>0)||dt>this.maxDt){this.gaps++;return {accepted:false,dt,reason:'time_gap',delta:[0,0],dv:[0,0]}}
  const dv=a.map((x,i)=>(prevA[i]+x)*.5*dt);
  if(stationary){this.v=[0,0];return {accepted:true,dt,dv,delta:[0,0],zupt:true}}
  const next=this.v.map((v,i)=>v+dv[i]);const delta=this.v.map((v,i)=>(v+next[i])*.5*dt);
  this.v=next;this.x=this.x.map((x,i)=>x+delta[i]);
  return {accepted:true,dt,dv,delta,zupt:false};
 }
}
export class TrackPair{
 constructor(){this.free=new InertialIntegrator();this.constrained=new InertialIntegrator()}
 reset(){this.free.reset();this.constrained.reset()}
 update(t,a,isStationary=false){return {free:this.free.update(t,a,false),constrained:this.constrained.update(t,a,isStationary)}}
}
