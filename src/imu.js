import {V,Q,G} from './math.js';

/** Device orientation (body -> reference world). Gravity correction is permitted
 * only after an independently measured stationary interval. A near-1g norm
 * alone is NOT evidence of rest, especially for horizontal translation.
 */
export class OrientationEstimator {
 constructor(){ this.reset(); }
 reset(){ this.q=[1,0,0,0]; this.bias=[0,0,0]; this.last=null; this.corrections=0; }
 calibrate(gravity,gyro){
  if(!V.valid(gravity)||!V.valid(gyro)) throw Error('Invalid calibration data');
  this.reset(); this.q=Q.fromGravity(gravity)||[1,0,0,0]; this.bias=gyro.slice();
 }
 update(s){
  if(!V.valid(s.raw)||!V.valid(s.gyro)||!Number.isFinite(s.t)) return null;
  if(this.last===null){this.last=s.t;return {q:this.q.slice(),dt:0,gated:true};}
  const dt=(s.t-this.last)/1000; this.last=s.t;
  if(!(dt>0)||dt>.1) return {q:this.q.slice(),dt,gap:true,gated:true};
  const rate=V.sub(s.gyro,this.bias);
  this.q=Q.integrate(this.q,rate,dt);
  // The detector must have observed a stable interval resembling calibration.
  // Do NOT correct attitude from acceleration while a push or slide is underway.
  const quiet=s.stationary===true && V.norm(rate)<.10 && Math.abs(V.norm(s.raw)-G)<.8;
  if(quiet){
   const norm=V.norm(s.raw);
   const expected=Q.rotate(Q.conj(this.q),[0,0,1]);
   const target=V.mul(s.raw,1/norm);
   const cross=[expected[1]*target[2]-expected[2]*target[1],
    expected[2]*target[0]-expected[0]*target[2],
    expected[0]*target[1]-expected[1]*target[0]];
   // Tilt only (gravity cannot determine yaw); bounded correction speed.
   const error=V.norm(cross);
   if(error>1e-8){
    const correction=V.mul(cross,-Math.min(0.4,0.4/error));
    this.q=Q.integrate(this.q,correction,dt);
   }
   this.corrections++;
  }
  return {q:this.q.slice(),dt,gated:!quiet};
 }
 gravity(){return V.mul(Q.rotate(Q.conj(this.q),[0,0,1]),G);}
}
