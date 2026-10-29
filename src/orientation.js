import {V,Q,G} from './math.js';
// Orientation q maps device measurements into a gravity-level frame (+Z up).
// It does not infer yaw from gravity. The initial heading is arbitrary.
export class OrientationEstimator {
  constructor(){this.reset()}
  reset(){this.q=Q.id();this.g=G;this.gyroBias=[0,0,0];this.lastT=null;this.stats={corrected:0,gated:0,gaps:0};this.lastInnovation=0}
  calibrate(gravityBody,gyroBias){
    const q=Q.fromTo(gravityBody,[0,0,1]);
    if(!q||!V.valid(gyroBias))throw Error('初期姿勢とジャイロを校正できません');
    this.reset();this.q=q;this.g=V.norm(gravityBody);this.gyroBias=gyroBias.slice();
  }
  predict(s){
    if(!V.valid(s.gyro)||!Number.isFinite(s.t))return {accepted:false,reason:'missing_gyro'};
    if(this.lastT===null){this.lastT=s.t;return {accepted:true,dt:0,first:true}}
    const dt=(s.t-this.lastT)/1000;this.lastT=s.t;
    if(dt<=0||dt>.12){this.stats.gaps++;return {accepted:false,reason:'time_gap',dt}}
    this.q=Q.integrate(this.q,V.sub(s.gyro,this.gyroBias),dt);
    return {accepted:true,dt};
  }
  correctFromGravity(gravityBody, dt, confidence){
    const error=Q.tiltError(this.q,gravityBody);this.lastInnovation=error.angle;
    if(!confidence||!(dt>0)||!Number.isFinite(error.angle)){this.stats.gated++;return false}
    // No innovation cutoff that could permanently lock out a misaligned filter.
    // Use slow bounded tilt correction ONLY during a sustained quiet interval.
    const correctionAngle=Math.min(error.angle,Math.min(.4*dt,1.5*error.angle*dt));
    this.q=Q.norm(Q.mul(this.q,Q.fromAxisAngle(error.axis,-correctionAngle)));
    this.stats.corrected++;return true;
  }
  gravityBody(){return V.mul(Q.rotate(Q.conj(this.q),[0,0,1]),this.g)}
  setKnownRestGyro(s){if(V.valid(s.gyro))this.gyroBias=s.gyro.slice()}
}
