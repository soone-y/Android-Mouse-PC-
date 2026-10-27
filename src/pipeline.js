import {G,V,Q} from './math.js';
import {OrientationEstimator} from './imu.js';
import {StationaryDetector} from './stationary.js';
import {TrackPair} from './integration.js';

/** Three independently reported channels:
 * fixed gravity subtraction, gyro tilt-compensated, and OS linear acceleration.
 * Do not merge them or reset free-integrated speed to conceal drift.
 */
export class MotionPipeline {
 constructor(){this.reset();}
 reset(){
  this.orientation=new OrientationEstimator();this.detector=new StationaryDetector();
  this.tracks={fixed:new TrackPair(),native:new TrackPair(),estimated:new TrackPair()};
  this.anchor=null;this.referenceGravity=null;this.calibration=null;this.latest=null;this.lastFrame=null;
 }
 beginCalibration(t){
  this.calibration={start:t,samples:[]};this.anchor=null;this.referenceGravity=null;this.latest=null;
  for(const track of Object.values(this.tracks))track.reset();
 }
 consume(s,{zupt=true,matchThreshold=.35}={}){
  if(!Number.isFinite(s.t))return null;
  if(this.calibration){
   if(V.valid(s.raw)&&V.valid(s.gyro))this.calibration.samples.push(s);
   if(s.t-this.calibration.start>=1200){
    const samples=this.calibration.samples;
    try{
     const ref=this.detector.setReference(samples);
     const mean=V.mean(samples.map(v=>v.raw)),q=Q.fromGravity(mean);
     if(!q)throw Error('重力方向を特定できません');
     this.orientation.calibrate(mean,ref.gyro);
     this.anchor=q;this.referenceGravity=mean.slice();this.calibration=null;
     return this.latest={phase:'calibrated',reference:ref};
    }catch(e){this.calibration=null;return this.latest={phase:'calibration_failed',message:e.message};}
   }
   return this.latest={phase:'calibrating',count:this.calibration.samples.length,elapsed:s.t-this.calibration.start};
  }
  if(!this.anchor)return this.latest={phase:'uncalibrated'};
  // Stationarity must be determined from unmodified sensor readings first.
  const stat=this.detector.observe(s,matchThreshold);
  const est=this.orientation.update({...s,stationary:stat.matched});
  if(!est)return this.latest={phase:'invalid',reason:'raw_or_gyro_missing'};
  const gravity=this.orientation.gravity();
  const calculated=V.sub(s.raw,gravity);
  const fixed=V.sub(s.raw,this.referenceGravity);
  const native=V.valid(s.native)?s.native:null;
  const vNative=native?Q.relative(this.anchor,est.q,native):null;
  const vEst=Q.relative(this.anchor,est.q,calculated);
  // Fixed reference uses the calibration frame only, without attitude prediction.
  const vFixed=Q.rotate(this.anchor,fixed);
  const stationary=Boolean(zupt&&stat.matched);
  const n=vNative?this.tracks.native.update(s.t,vNative.slice(0,2),stationary):null;
  const p=this.tracks.estimated.update(s.t,vEst.slice(0,2),stationary);
  const f=this.tracks.fixed.update(s.t,vFixed.slice(0,2),stationary);
  return this.latest={phase:'operating',t:s.t,interval:s.interval,raw:s.raw,gyro:s.gyro,native,
   gravity,fixedGravity:this.referenceGravity.slice(),fixedLinear:fixed,estimatedLinear:calculated,
   q:est.q,orientationGate:est.gated,orientationGap:est.gap,
   anchoredNative:vNative,anchoredEstimated:vEst,anchoredFixed:vFixed,
   stationaryEvidence:stat.matched,stationaryApplied:stationary,stationaryError:stat.errA,
   gapNative:n?.free?.reason==='time_gap',gapEstimated:p.free.reason==='time_gap',gapFixed:f.free.reason==='time_gap',tracks:this.tracks};
 }
}
export function parseMotionEvent(e,t){
 const vec=o=>o&&[o.x,o.y,o.z].every(Number.isFinite)?[o.x,o.y,o.z]:null;
 const r=e.rotationRate,gyro=r&&[r.beta,r.gamma,r.alpha].every(Number.isFinite)?[r.beta,r.gamma,r.alpha].map(v=>v*Math.PI/180):null;
 return {t,raw:vec(e.accelerationIncludingGravity),native:vec(e.acceleration),gyro,interval:Number.isFinite(e.interval)?e.interval:null};
}
