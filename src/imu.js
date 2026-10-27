import {V,Q,G} from './math.js';
/** Orientation predictor: gyro plus gravity-direction nudging ONLY when motion is quiet.
 * A gravity reading cannot resolve yaw. During translation, tilt correction is gated to
 * avoid interpreting linear acceleration as gravity. Assumes device accelerationIncludingGravity
 * points along +gravity in the calibrated rest posture, as in original implementation.
 */
export class OrientationEstimator{
 constructor(){this.reset()}
 reset(){this.q=[1,0,0,0];this.bias=[0,0,0];this.last=null;this.corrections=0}
 calibrate(gravity,gyro){this.reset();this.q=Q.fromGravity(gravity)||[1,0,0,0];this.bias=gyro.slice()}
 update(s){if(!V.valid(s.raw)||!V.valid(s.gyro))return null;
  if(this.last===null){this.last=s.t;return {q:this.q.slice(),dt:0,gated:true}}
  const dt=(s.t-this.last)/1000;this.last=s.t;
  if(!(dt>0)||dt>.1)return {q:this.q.slice(),dt,gap:true,gated:true};
  this.q=Q.integrate(this.q,V.sub(s.gyro,this.bias),dt);
  // Gate gravitational inclination correction when strong linear movement is present.
  const norm=V.norm(s.raw),nativeQuiet=!V.valid(s.native)||V.norm(s.native)<.35;
  const expectedGravity=this.gravity();
  // A horizontal acceleration can change |raw| only very slightly; compare the full vector.
  const gated=Math.abs(norm-G)>.25||V.norm(V.sub(s.raw,expectedGravity))>.35||!nativeQuiet;
  if(!gated&&norm>1){
   const g=Q.rotate(Q.conj(this.q),[0,0,1]); const target=V.mul(s.raw,1/norm);
   // cross(actual predicted g, measured g) in body frame, use bounded tilt correction
   const cross=[g[1]*target[2]-g[2]*target[1],g[2]*target[0]-g[0]*target[2],g[0]*target[1]-g[1]*target[0]];
   this.q=Q.integrate(this.q,V.mul(cross,-.3),dt);this.corrections++;
  }
  return {q:this.q.slice(),dt,gated};
 }
 gravity(){return V.mul(Q.rotate(Q.conj(this.q),[0,0,1]),G)}
}
