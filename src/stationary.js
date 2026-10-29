import {V,G} from './math.js';
// 'quiet' is only an IMU-based hypothesis, NOT proof of zero ground speed.
// No comparison to initial orientation; a stationary phone can rest at ANY tilt.
export class QuietDetector {
  constructor(){this.reset()}
  reset(){this.samples=[];this.since=null;this.quiet=false;this.reason='insufficient_data';this.previousT=null}
  update(s,gravityMagnitude=G,gyroBias=[0,0,0]){
    if(!V.valid(s.raw)||!V.valid(s.gyro)){
      this.reset();return this.snapshot(false,'missing_data');
    }
    if(this.previousT!==null && (s.t<=this.previousT || s.t-this.previousT>140))this.reset();
    this.previousT=s.t;
    this.samples.push({t:s.t,raw:s.raw.slice(),gyro:V.sub(s.gyro,gyroBias),native:V.valid(s.native)?s.native.slice():null});
    while(this.samples.length && this.samples[0].t<s.t-650)this.samples.shift();
    const recent=this.samples.filter(x=>x.t>=s.t-300);
    if(recent.length<8 || recent.at(-1).t-recent[0].t<160)return this.snapshot(false,'insufficient_window');
    const meanRaw=V.mean(recent.map(x=>x.raw)),meanGyro=V.mean(recent.map(x=>x.gyro));
    const accelScatter=V.rmsDeviation(recent.map(x=>x.raw),meanRaw);
    const gyroScatter=V.rmsDeviation(recent.map(x=>x.gyro),meanGyro);
    const nativeValid=recent.filter(x=>x.native!==null),meanNative=nativeValid.length>=recent.length*.8?V.mean(nativeValid.map(x=>x.native)):null;
    // Norm-alone is not enough; use temporal stability, low angular rate and (if present) OS linear acceleration.
    const checks={
      gravity:Math.abs(V.norm(meanRaw)-gravityMagnitude)<.38,
      accelStable:accelScatter<.14,
      gyroStable:gyroScatter<.035,
      gyroSmall:V.norm(meanGyro)<.07,
      osQuiet:!meanNative||V.norm(meanNative)<.25,
    };
    const pass=Object.values(checks).every(Boolean);
    if(!pass){this.since=null;this.quiet=false;this.reason=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k).join(',');}
    else{
      if(this.since===null)this.since=s.t;
      this.quiet=s.t-this.since>=450;
      this.reason=this.quiet?'quiet_like':'settling';
    }
    return {quiet:this.quiet,pass,reason:this.reason,meanRaw,meanGyro,meanNative,accelScatter,gyroScatter,elapsedMs:this.since===null?0:s.t-this.since};
  }
  snapshot(quiet,reason){return {quiet,pass:false,reason,meanRaw:null,meanGyro:null,meanNative:null,accelScatter:null,gyroScatter:null,elapsedMs:0}}
}
