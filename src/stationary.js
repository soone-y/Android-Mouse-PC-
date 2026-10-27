import {G,V,varianceNorm3} from './math.js';
/** Evidence-based but not proof of rest: compares sensor data with reference, checks stability.
 * Constant velocity is observationally indistinguishable from rest with IMU alone.
 */
export class StationaryDetector{
 constructor(){this.clear()}
 clear(){this.ref=null;this.window=[];this.since=null;this.active=false}
 setReference(samples){const raw=samples.map(s=>s.raw).filter(V.valid),gyro=samples.map(s=>s.gyro).filter(V.valid);
  if(raw.length<15||gyro.length!==raw.length)throw Error('初期静止サンプルが不足しています');
  const ra=V.mean(raw),rg=V.mean(gyro);const noiseA=Math.sqrt(varianceNorm3(raw,ra)),noiseG=Math.sqrt(varianceNorm3(gyro,rg));
  if(noiseA>.7||noiseG>.15||V.norm(rg)>.15||Math.abs(V.norm(ra)-G)>1)throw Error('初期補正中に端末が動いているか、重力値が不適切です。静止させてやり直してください');
  this.clear();this.ref={raw:ra,gyro:rg,noiseA,noiseG,count:raw.length};return this.ref;
 }
 observe(s,threshold=.35){if(!this.ref||!V.valid(s.raw)||!V.valid(s.gyro))return {matched:false,reason:'no_reference'};
  this.window.push(s);while(this.window.length&&this.window[0].t<s.t-350)this.window.shift();
  const errA=V.norm(V.sub(s.raw,this.ref.raw)),errG=V.norm(V.sub(s.gyro,this.ref.gyro));
  const pass=errA<threshold&&errG<.1;
  if(!pass){this.since=null;this.active=false;return {matched:false,errA,errG}}
  if(this.since===null)this.since=s.t;
  const raw=this.window.map(x=>x.raw),gyro=this.window.map(x=>x.gyro);
  const stdA=Math.sqrt(varianceNorm3(raw)),stdG=Math.sqrt(varianceNorm3(gyro));
  this.active=s.t-this.since>=450&&this.window.length>=12&&stdA<Math.max(.12,2*this.ref.noiseA+.07)&&stdG<Math.max(.04,2*this.ref.noiseG+.025);
  return {matched:this.active,errA,errG,stdA,stdG};
 }
}
