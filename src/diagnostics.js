import {flattenComparison} from './comparison.js';
import {TrackPair} from './integration.js';
export class Recorder{
 constructor(max=15000){this.max=max;this.clear()}
 clear(){this.active=false;this.startTime=null;this.startWall=null;this.samples=[];this.events=[];this.calibration=null;this.reason=null}
 start(t,config){this.clear();this.active=true;this.startTime=t;this.startWall=new Date().toISOString();this.config=structuredClone(config);this.mark(t,'record_start')}
 stop(t,reason='manual'){if(!this.active)return;this.mark(t,'record_stop',{reason});this.active=false;this.reason=reason}
 mark(t,event,data={}){if(this.startTime!==null)this.events.push({t_ms:+(t-this.startTime).toFixed(3),event,...data})}
 add(t,frame,output,diagnostic=null){if(!this.active)return;if(this.samples.length>=this.max){this.stop(t,'limit');return}
  const t_ms=+(t-this.startTime).toFixed(3);const row={t_ms,kind:'sample',phase:output?.phase||'',interval_ms:frame.interval,raw_a_x:frame.raw?.[0],raw_a_y:frame.raw?.[1],raw_a_z:frame.raw?.[2],gyro_x:frame.gyro?.[0],gyro_y:frame.gyro?.[1],gyro_z:frame.gyro?.[2],native_a_x:frame.native?.[0],native_a_y:frame.native?.[1],native_a_z:frame.native?.[2]};
  if(output?.phase==='operating'){
   const f=output;Object.assign(row,{q_w:f.q[0],q_x:f.q[1],q_y:f.q[2],q_z:f.q[3],gravity_x:f.gravity[0],gravity_y:f.gravity[1],gravity_z:f.gravity[2],estimated_a_x:f.estimatedLinear[0],estimated_a_y:f.estimatedLinear[1],estimated_a_z:f.estimatedLinear[2],anchor_native_x:f.anchoredNative?.[0],anchor_native_y:f.anchoredNative?.[1],anchor_native_z:f.anchoredNative?.[2],anchor_est_x:f.anchoredEstimated[0],anchor_est_y:f.anchoredEstimated[1],anchor_est_z:f.anchoredEstimated[2],anchor_fixed_x:f.anchoredFixed[0],anchor_fixed_y:f.anchoredFixed[1],anchor_fixed_z:f.anchoredFixed[2],matched:f.stationaryEvidence?1:0,zupt:f.stationaryApplied?1:0,orientation_gated:f.orientationGate?1:0,orientation_gap:f.orientationGap?1:0,stationary_error:f.stationaryError,integrator_gap:f.gapNative||f.gapEstimated?1:0});
   for(const src of ['fixed','native','estimated'])for(const mode of ['free','constrained']){
    const p=f.tracks[src][mode],prefix=src+'_'+mode;
    row[prefix+'_vx']=p.v[0];row[prefix+'_vy']=p.v[1];row[prefix+'_x']=p.x[0];row[prefix+'_y']=p.x[1];
   }
  }
  Object.assign(row,flattenComparison(diagnostic));
  this.samples.push(row);
 }
 snapshot(){return {schema:'sensor-mouse-v9/1',startWall:this.startWall,units:{time:'ms',acceleration:'m/s²',angularVelocity:'rad/s',velocity:'m/s',position:'m'},config:this.config,calibration:this.calibration,events:this.events,samples:this.samples,reason:this.reason}}
}
export const columns=['t_ms','kind','phase','event','detail','interval_ms','raw_a_x','raw_a_y','raw_a_z','gyro_x','gyro_y','gyro_z','native_a_x','native_a_y','native_a_z','q_w','q_x','q_y','q_z','gravity_x','gravity_y','gravity_z','estimated_a_x','estimated_a_y','estimated_a_z','anchor_native_x','anchor_native_y','anchor_native_z','anchor_est_x','anchor_est_y','anchor_est_z','anchor_fixed_x','anchor_fixed_y','anchor_fixed_z','corrected_x','corrected_y','anchor_a_x','anchor_a_y','matched','zupt','orientation_gated','orientation_gap','stationary_error','integrator_gap',...['fixed_free','fixed_constrained','native_free','native_constrained','estimated_free','estimated_constrained'].flatMap(prefix=>[prefix+'_vx',prefix+'_vy',prefix+'_x',prefix+'_y'])];
function csvCell(v){if(v===undefined||v===null)return '';const s=typeof v==='object'?JSON.stringify(v):String(v);const safe=/^[=+@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"'}
export function exportCsv(snapshot){let data=[...snapshot.samples,...snapshot.events.map(r=>({...r,kind:'event',detail:JSON.stringify(r)}))].sort((a,b)=>a.t_ms-b.t_ms);
 const keys=[...new Set([...columns,...data.flatMap(r=>Object.keys(r))])];return '\ufeff'+keys.join(',')+'\r\n'+data.map(r=>keys.map(k=>csvCell(r[k])).join(',')).join('\r\n')}
export function parseCsv(text){const records=[];let row=[],part='',quoted=false;const value=text.replace(/^\ufeff/,'');
 for(let i=0;i<value.length;i++){const c=value[i];if(quoted){if(c==='"'&&value[i+1]==='"'){part+='"';i++}else if(c==='"')quoted=false;else part+=c}
 else if(c==='"')quoted=true;else if(c===','){row.push(part);part=''}else if(c==='\n'){row.push(part.replace(/\r$/,''));records.push(row);row=[];part=''}else part+=c}
 if(part||row.length){row.push(part);records.push(row)}if(!records.length)throw Error('空のCSVです');const h=records.shift();return records.filter(r=>r.some(v=>v!=='')).map(r=>Object.fromEntries(h.map((name,i)=>[name,r[i]??''])))}
const num=(r,k)=>r[k]===''||r[k]===undefined?null:Number.isFinite(Number(r[k]))?Number(r[k]):null;
/** Offline, fully deterministic replay of stored planar acceleration (v6/v7 compatible).
 * 'clean' uses no adaptive acceleration shift when source column is anchor_a_*. 
 * Event timing and e.interval timing are compared, not conflated.
 */
export function replayRows(rows,{source='anchor',applyZupt=true}={}){
 const selection={anchor:[['anchor_native_x','anchor_native_y'],['anchor_a_x','anchor_a_y'],['anchor_est_x','anchor_est_y']],processed:[['corrected_x','corrected_y'],['anchor_native_x','anchor_native_y'],['anchor_a_x','anchor_a_y']]};
 const candidates=selection[source]||selection.anchor;
 const samples=rows.filter(r=>(!r.kind||r.kind==='sample')&&num(r,'t_ms')!==null);
 const chosen=candidates.find(keys=>samples.some(r=>keys.every(k=>num(r,k)!==null)));
 if(!chosen)throw Error('再生に必要な補正済み平面加速度の列がありません');
 const a=new TrackPair(),b=new TrackPair();let nominal=0,last=null,applied=0,gap=0;const paths={event:[],nominal:[],constrained:[]},graphRows=[];
 for(const row of samples){const acceleration=chosen.map(k=>num(row,k));if(acceleration.some(v=>v===null))continue;
  const t=num(row,'t_ms');const interval=num(row,'interval_ms');
  if(last!==null){nominal+=interval&&interval>0&&interval<=100?interval:t-last}
  const stationary=applyZupt&&Boolean(num(row,'matched')??num(row,'zupt'));
  const first=a.update(t,acceleration,stationary),second=b.update(nominal,acceleration,false);
  if(first.free.reason==='time_gap'||second.free.reason==='time_gap')gap++;
  if(stationary)applied++;
  paths.event.push(a.free.x.slice());paths.nominal.push(b.free.x.slice());paths.constrained.push(a.constrained.x.slice());graphRows.push({t,acc:acceleration.slice(),eventV:a.free.v.slice(),nominalV:b.free.v.slice(),constrainedV:a.constrained.v.slice()});last=t;
 }
 const stats=p=>({position:p.x.slice(),velocity:p.v.slice(),gaps:p.gaps});
 return {columns:chosen,samples:paths.event.length,applied,gap,paths,graphRows,event:stats(a.free),nominal:stats(b.free),constrained:stats(a.constrained),note:source==='processed'?'旧版corrected列は積分前の自動バイアス補正を含む場合があります。':'anchor列を優先し、旧版の加速度シフトを可能な範囲で除外しています。'};
}
export function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
