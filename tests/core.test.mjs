import test from 'node:test';
import assert from 'node:assert/strict';
import {G,V,Q} from '../src/math.js';
import {MotionPipeline} from '../src/pipeline.js';
import {QuietDetector} from '../src/stationary.js';
import {correctRestToRest} from '../src/integration.js';
import {parseSimpleCSV,normalizeReplay} from '../src/recording.js';
import {readFileSync,existsSync} from 'node:fs';

const near=(a,b,tol=1e-3)=>assert.ok(Math.abs(a-b)<tol,`${a} !~= ${b} (tol ${tol})`);
const run=(get,n=500,dt=0.02)=>{
  const engine=new MotionPipeline();engine.beginCalibration(0);let last=null;
  for(let i=0;i<=n;i++){
    const t=i*dt,s=get(t,i);const out=engine.consume({...s,t:t*1000,interval:dt*1000},{zupt:true});
    if(out.phase==='operating')last=out;
    else if(out.phase==='calibration_failed')throw Error(out.reason);
  }
  return {engine,last};
};
test('quaternion from-to carries any rest gravity onto level frame',()=>{
  const g=[G*.6,G*.4,G*Math.sqrt(1-.36-.16)];const q=Q.fromTo(g,[0,0,1]);
  const mapped=Q.rotate(q,g);near(mapped[0],0);near(mapped[1],0);near(mapped[2],G);
});
test('quiet detector accepts 30 degree tilted STILL pose, independent of initial posture',()=>{
  const d=new QuietDetector();const tilted=[G*.5,0,G*Math.sqrt(.75)];let r;
  for(let i=0;i<55;i++)r=d.update({t:i*20,raw:tilted,gyro:[0,0,0],native:[0,0,0]},G,[0,0,0]);
  assert.equal(r.quiet,true);
});
test('no false horizontal acceleration when rest is tilted and later rotated',()=>{
  const q0=Q.fromAxisAngle([0,1,0],Math.PI/8),q1=Q.fromAxisAngle([1,0,0],Math.PI/5);
  const s=t=>{
    const q=t<2? q0 : t<2.6?Q.mul(q0,Q.fromAxisAngle([1,0,0],(t-2)/.6*Math.PI/5)):Q.mul(q0,q1);
    const gyro=t>=2&&t<2.6?[Math.PI/5/.6,0,0]:[0,0,0];
    const raw=Q.rotate(Q.conj(q),[0,0,G]);
    return {raw,gyro,native:[0,0,0]};
  };
  const {last}=run(s);
  near(V.norm(last.estimatedBody),0,.05);
  near(V.norm(last.aWorld.estimated),0,.05);
  assert.equal(last.quiet.quiet,true);
});
test('1 degree tilted gyro drift must recover in quiet without stuck innovation gating',()=>{
  const p=new MotionPipeline();p.beginCalibration(0);
  for(let i=0;i<80;i++)p.consume({t:i*20,raw:[0,0,G],gyro:[0,0,0],native:[0,0,0]});
  // corrupt orientation estimator by 4°; after 5 seconds quiet it must recover
  p.orientation.q=Q.mul(p.orientation.q,Q.fromAxisAngle([0,1,0],4*Math.PI/180));
  let out;
  for(let i=80;i<350;i++)out=p.consume({t:i*20,raw:[0,0,G],gyro:[0,0,0],native:[0,0,0]});
  near(out.tiltInnovationDeg,0,.03);
  near(out.aWorld.estimated[0],0,.01);
});
test('true horizontal push/decelerate integrates to 36cm, not 20m',()=>{
  const {last}=run(t=>{const a=t>=2&&t<2.3?4:t>=2.3&&t<2.6?-4:0;return {raw:[a,0,G],native:[a,0,0],gyro:[0,0,0]}});
  near(last.tracks.estimated.free.x[0],.36,.008);
  near(last.tracks.estimated.free.v[0],0,.003);
  near(last.tracks.native.free.x[0],.36,.008);
});
test('zero-end-velocity method cancels static offset in marked rest-to-rest run',()=>{
  let rows=[];for(let i=0;i<=100;i++){const t=i*.01,a=t<.3?4:t<.6?-4:0;rows.push({t:t*1000,a:[a+.12,-.07]});}
  const out=correctRestToRest(rows);
  near(out.bias[0],.12,.03);near(out.bias[1],-.07,.002);
  near(out.terminalVelocity[0],0,1e-9);
});
test('rejected timestamp gap does not integrate invented interval',()=>{
  const {engine}=run(t=>({raw:[0,0,G],native:[0,0,0],gyro:[0,0,0]}),100);
  const gap=engine.consume({t:3500,raw:[1,0,G],native:[1,0,0],gyro:[0,0,0]});
  assert.equal(gap.phase,'gap');
});
test('legacy comparison CSV can be parsed for replay',()=>{
  const csv='comparison_t_ms,compare_raw_x,compare_raw_y,compare_raw_z,compare_gyro_x,compare_gyro_y,compare_gyro_z\n0,0,0,9.81,0,0,0\n';
  const rows=parseSimpleCSV(csv+Array.from({length:30},(_,i)=>`${(i+1)*20},0,0,9.81,0,0,0`).join('\n'));
  const out=normalizeReplay(rows);assert.equal(out.length,31);
});
test('gyro yaw turn then translation uses a stable horizontal world frame',()=>{
  const turn=Math.PI/2,rate=turn/.6;
  const {last}=run(t=>{
    const alpha=Math.min(1,Math.max(0,(t-2)/.6))*turn;
    const q=Q.fromAxisAngle([0,0,1],alpha);
    const worldAccel=[t>=3&&t<3.3?4:t>=3.3&&t<3.6?-4:0,0,0];
    const bodyLinear=Q.rotate(Q.conj(q),worldAccel);
    const gravity=Q.rotate(Q.conj(q),[0,0,G]);
    return {raw:V.add(bodyLinear,gravity),native:bodyLinear,gyro:[0,0,t>=2&&t<2.6?rate:0]};
  });
  near(last.tracks.estimated.free.x[0],.36,.02);
  near(last.tracks.estimated.free.x[1],0,.02);
  near(last.tracks.estimated.free.v[0],0,.02);
});
