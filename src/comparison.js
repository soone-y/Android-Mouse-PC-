import {V,Q} from './math.js';

// Experimental branch: all outputs are separate from pointer-control/ZUPT paths.
class Integrator3 {
 constructor(){this.reset()}
 reset(){this.t=null;this.a=null;this.v=[0,0,0];this.x=[0,0,0];this.positive=[0,0,0];this.negative=[0,0,0]}
 step(t,a){
  if(!V.valid(a)){this.t=null;this.a=null;return {status:'missing_acceleration'}}
  if(this.t===null){this.t=t;this.a=a.slice();return {status:'first'}}
  const dt=(t-this.t)/1000,prev=this.a;this.t=t;this.a=a.slice();
  if(!(dt>0)||dt>.1)return {status:'invalid_dt',dt};
  const dv=a.map((z,i)=>(z+prev[i])*dt/2);
  const oldV=this.v.slice();this.v=this.v.map((v,i)=>v+dv[i]);
  this.x=this.x.map((x,i)=>x+(oldV[i]+this.v[i])*dt/2);
  dv.forEach((d,i)=>{if(d>=0)this.positive[i]+=d;else this.negative[i]+=d});
  return {status:'integrated',dt,dv};
 }
 snapshot(){return {v:this.v.slice(),x:this.x.slice(),positive:this.positive.slice(),negative:this.negative.slice()}}
}
const MODES=['fixed','dynamic','os'];
export class GravityComparison {
 constructor(){this.reset()}
 reset(){this.reference=null;this.initialQ=null;this.lastQ=null;this.integrators=Object.fromEntries(MODES.flatMap(m=>['device','initial'].map(c=>[`${m}_${c}`,new Integrator3()])));this.rows=[];this.limit=15000}
 calibrate(gravity){if(!V.valid(gravity))throw Error('Calibration gravity vector is missing');this.reference=gravity.slice();this.initialQ=Q.fromGravity(gravity);this.lastQ=this.initialQ?.slice();if(!this.initialQ)throw Error('Invalid gravity');for(const p of Object.values(this.integrators))p.reset();this.rows=[]}
 update(s,q){if(!this.reference)return null;
  const qValid=Array.isArray(q)&&q.length===4&&q.every(Number.isFinite);
  if(qValid)this.lastQ=q.slice();
  // Q maps the current device to an inertial frame; gravity in current body = q^-1 * +Z * |g0|.
  const dynamicGravity=qValid?V.mul(Q.rotate(Q.conj(q),[0,0,1]),V.norm(this.reference)):null;
  const gravity={fixed:this.reference.slice(),dynamic:dynamicGravity,os:null};
  const device={fixed:V.valid(s.raw)?V.sub(s.raw,gravity.fixed):null,dynamic:V.valid(s.raw)&&dynamicGravity?V.sub(s.raw,dynamicGravity):null,os:V.valid(s.native)?s.native.slice():null};
  const initial={};const results={};const statuses={};
  for(const m of MODES){
   // For fixed, this is a diagnostic transformation ONLY, not part of fixed gravity subtraction.
   initial[m]=device[m]&&qValid?Q.relative(this.initialQ,q,device[m]):null;
   for(const c of ['device','initial']){
    const key=`${m}_${c}`;const a=c==='device'?device[m]:initial[m];
    statuses[key]=this.integrators[key].step(s.t,a);results[key]=a?this.integrators[key].snapshot():null;
   }
  }
  const row={t:s.t,interval:s.interval,raw:s.raw?.slice()||null,gyro:s.gyro?.slice()||null,os:s.native?.slice()||null,q:qValid?q.slice():null,gravity,device,initial,results,statuses};
  this.rows.push(row);if(this.rows.length>this.limit)this.rows.shift();return row;
 }
}
export function flattenComparison(row){if(!row)return {};
 const out={comparison_t_ms:row.t,comparison_dt_sensor_ms:row.interval};
 const vec=(prefix,a)=>{for(let i=0;i<3;i++)out[`${prefix}_${'xyz'[i]}`]=a?.[i]??null};
 vec('compare_raw',row.raw);vec('compare_gyro',row.gyro);vec('compare_os_input',row.os);if(row.q)row.q.forEach((v,i)=>out[`compare_q_${'wxyz'[i]}`]=v);
 for(const m of MODES){vec(`compare_${m}_gravity`,row.gravity[m]);vec(`compare_${m}_device_a`,row.device[m]);vec(`compare_${m}_initial_a`,row.initial[m]);for(const c of ['device','initial']){const key=`${m}_${c}`,r=row.results[key];vec(`compare_${key}_v`,r?.v);vec(`compare_${key}_x`,r?.x);vec(`compare_${key}_dv_positive`,r?.positive);vec(`compare_${key}_dv_negative`,r?.negative);out[`compare_${key}_status`]=row.statuses[key].status;out[`compare_${key}_dt_s`]=row.statuses[key].dt??null;}}
 return out;
}
