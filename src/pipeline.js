import {V,Q,G} from './math.js';
import {QuietDetector} from './stationary.js';
import {OrientationEstimator} from './orientation.js';
import {TrackPair} from './integration.js';

export class MotionPipeline {
  constructor(){this.reset()}
  reset(){
    this.orientation=new OrientationEstimator();this.quiet=new QuietDetector();
    this.tracks={native:new TrackPair(),estimated:new TrackPair(),fixed:new TrackPair()};
    this.calibration=null;this.reference=null;this.last=null;this.lastStatus='未校正';this.processed=0;
  }
  beginCalibration(t){this.reset();this.calibration={start:t,samples:[]};this.lastStatus='静止校正中'}
  consume(s,{zupt=true}={}){
    if(!Number.isFinite(s?.t))return {phase:'invalid',reason:'invalid_timestamp'};
    if(this.calibration){
      if(V.valid(s.raw)&&V.valid(s.gyro))this.calibration.samples.push(s);
      const elapsed=s.t-this.calibration.start;
      if(elapsed<1500)return {phase:'calibrating',elapsed,count:this.calibration.samples.length};
      const xs=this.calibration.samples,raw=V.mean(xs.map(x=>x.raw)),gyro=V.mean(xs.map(x=>x.gyro));
      const rawScatter=V.rmsDeviation(xs.map(x=>x.raw),raw),gyroScatter=V.rmsDeviation(xs.map(x=>x.gyro),gyro);
      const nativeSamples=xs.map(x=>x.native).filter(V.valid);
      const nativeBias=nativeSamples.length>xs.length*.8?V.mean(nativeSamples):[0,0,0];
      this.calibration=null;
      if(xs.length<25||V.norm(raw)<8.8||V.norm(raw)>10.8||rawScatter>.25||gyroScatter>.05||V.norm(gyro)>.2 || V.norm(nativeBias)>.4){
        this.lastStatus='校正失敗：静止して再実行';
        return {phase:'calibration_failed',reason:'測定中の揺れ・回転・サンプル不足を検出。静止させて再実行してください',details:{count:xs.length,rawScatter,gyroScatter,nativeBias}};
      }
      this.orientation.calibrate(raw,gyro);
      this.quiet.reset();this.reference={raw,gyro,g:V.norm(raw),nativeBias,rawScatter,gyroScatter,count:xs.length};
      this.lastStatus='計測中';
      return {phase:'calibrated',reference:this.reference,q:this.orientation.q.slice()};
    }
    if(!this.reference)return {phase:'uncalibrated'};
    if(!V.valid(s.raw)||!V.valid(s.gyro))return {phase:'invalid',reason:'missing_accel_or_gyro'};
    const prediction=this.orientation.predict(s);
    const quiet=this.quiet.update(s,this.reference.g,this.orientation.gyroBias);
    if(!prediction.accepted){
      // Timestamp gap: do not interpret the interrupted sample as a physical acceleration.
      return {phase:'gap',reason:prediction.reason,dt:prediction.dt,quiet};
    }
    const gravityBefore=this.orientation.gravityBody();
    const innovation=Q.tiltError(this.orientation.q,quiet.meanRaw||s.raw).angle;
    const corrected=this.orientation.correctFromGravity(quiet.meanRaw||s.raw,prediction.dt,quiet.quiet);
    const gravityBody=this.orientation.gravityBody();
    const linearBody=V.sub(s.raw,gravityBody);
    // q alone maps device -> horizontal anchored world. Do not prepend q0^-1;
    // that would rotate into the tilted INITIAL PHONE PLANE instead.
    const estimatedWorld=Q.rotate(this.orientation.q,linearBody);
    const nativeBody=V.valid(s.native)?s.native:null;
    const nativeWorld=nativeBody?Q.rotate(this.orientation.q,nativeBody):null;
    const fixedBody=V.sub(s.raw,this.reference.raw);
    const fixedWorld=Q.rotate(Q.fromTo(this.reference.raw,[0,0,1]),fixedBody);
    const aWorld={estimated:estimatedWorld,native:nativeWorld,fixed:fixedWorld};
    const stopCandidate=Boolean(zupt&&quiet.quiet);
    for(const src of ['estimated','native','fixed'])if(aWorld[src])this.tracks[src].step(s.t,aWorld[src].slice(0,2),stopCandidate);
    this.processed++;
    return this.last={phase:'operating',t:s.t,dt:prediction.dt,raw:s.raw.slice(),gyro:s.gyro.slice(),native:nativeBody?.slice()||null,
      q:this.orientation.q.slice(),gravityBody,gravityBefore,estimatedBody:linearBody,
      aWorld,quiet,zupt:stopCandidate,tiltInnovationDeg:innovation*180/Math.PI,orientationCorrected:corrected,
      gyroBias:this.orientation.gyroBias.slice(),tracks:this.tracks,orientationStats:{...this.orientation.stats},
      osEstimatedResidual:nativeBody?V.sub(linearBody,nativeBody):null,
      reference:this.reference};
  }
  confirmRest(s){
    if(!this.reference)return false;
    for(const track of Object.values(this.tracks))track.constrained.v=[0,0];
    // Do not change orientation based on an isolated user click; explicit rest lets us
    // update gyro bias when the user has physically held the device at rest.
    if(s&&V.valid(s.gyro)&&this.quiet.quiet){this.orientation.setKnownRestGyro(s)}
    return true;
  }
}

// devicemotion rotationRate fields are beta(X), gamma(Y), alpha(Z), degrees/s.
export function parseMotionEvent(e,t){
  const v=obj=>obj&&[obj.x,obj.y,obj.z].every(Number.isFinite)?[obj.x,obj.y,obj.z]:null;
  const r=e.rotationRate;
  const gyro=r&&[r.beta,r.gamma,r.alpha].every(Number.isFinite)?[r.beta,r.gamma,r.alpha].map(x=>x*Math.PI/180):null;
  const eventTime=Number.isFinite(e.timeStamp)&&e.timeStamp>0&&e.timeStamp<1e10?e.timeStamp:t;
  return {t:eventTime,raw:v(e.accelerationIncludingGravity),native:v(e.acceleration),gyro,interval:Number.isFinite(e.interval)?e.interval:null};
}
