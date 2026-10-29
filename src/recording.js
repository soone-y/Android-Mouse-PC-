export const SOURCES=['estimated','native','fixed'];
export class Recorder {
  constructor(){this.reset()}
  reset(){this.active=false;this.rows=[];this.events=[];this.startedAt=null;this.reference=null}
  start(t,reference){this.reset();this.active=true;this.startedAt=t;this.reference=reference?structuredClone(reference):null;this.mark(t,'record_start')}
  mark(t,type,extra={}){if(this.startedAt!==null)this.events.push({t_ms:+(t-this.startedAt).toFixed(3),type,...extra})}
  record(s,out){if(!this.active)return;
    if(this.rows.length>=30000){this.stop(s.t);return}
    const track={};
    if(out?.phase==='operating')for(const src of SOURCES){const t=out.tracks[src];track[src]={free:t.free.snapshot(),constrained:t.constrained.snapshot()}}
    this.rows.push({t_ms:+(s.t-this.startedAt).toFixed(3),t:s.t,interval:s.interval,raw:s.raw,gyro:s.gyro,native:s.native,
      phase:out?.phase||'',q:out?.q||null,gravity:out?.gravityBody||null,estimatedBody:out?.estimatedBody||null,
      world:out?.aWorld||null,quiet:out?.quiet||null,zupt:out?.zupt||false,tiltInnovationDeg:out?.tiltInnovationDeg??null,
      orientationCorrected:out?.orientationCorrected||false,track});
  }
  stop(t){if(this.active){this.mark(t,'record_stop');this.active=false}}
  json(){return {schema:'sensor-mouse-lab/10',createdAt:new Date().toISOString(),reference:this.reference,events:this.events,rows:this.rows,units:{t:'ms',acceleration:'m/s²',angularVelocity:'rad/s',position:'m'}}}
}
export function exportCsv(rows){
  const header=['t_ms','phase','interval_ms','raw_a_x','raw_a_y','raw_a_z','gyro_x','gyro_y','gyro_z','native_a_x','native_a_y','native_a_z',
    'q_w','q_x','q_y','q_z','gravity_x','gravity_y','gravity_z','est_a_x','est_a_y','est_a_z','world_est_x','world_est_y','world_est_z',
    'world_native_x','world_native_y','world_native_z','world_fixed_x','world_fixed_y','world_fixed_z','quiet','zupt','tilt_error_deg',
    ...SOURCES.flatMap(s=>['free','constrained'].flatMap(t=>[`${s}_${t}_vx`,`${s}_${t}_vy`,`${s}_${t}_x`,`${s}_${t}_y`]))];
  const result=[header.join(',')];
  const pair=(x)=>x??[null,null,null];
  for(const r of rows){const values=[r.t_ms,r.phase,r.interval,...pair(r.raw),...pair(r.gyro),...pair(r.native),...(r.q??[null,null,null,null]),
    ...pair(r.gravity),...pair(r.estimatedBody),...pair(r.world?.estimated),...pair(r.world?.native),...pair(r.world?.fixed),
    r.quiet?.quiet?1:0,r.zupt?1:0,r.tiltInnovationDeg,
    ...SOURCES.flatMap(s=>['free','constrained'].flatMap(t=>[...(r.track?.[s]?.[t]?.v??[null,null]),...(r.track?.[s]?.[t]?.x??[null,null])]))];
    result.push(values.map(v=>v==null?'':typeof v==='string'?`"${v.replaceAll('"','""')}"`:String(v)).join(','));
  }
  return '\ufeff'+result.join('\r\n');
}
export function saveDownload(text,name,mime){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
// Historical comparison CSV and previous version native CSV are accepted as replay inputs.
export function parseSimpleCSV(str){
  const lines=str.replace(/^\ufeff/,'').trim().split(/\r?\n/);if(lines.length<2)throw Error('CSVが空です');
  const parse=s=>{const a=[];let q=false,x='';for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(q&&s[i+1]==='"'){x+='"';i++}else q=!q}else if(c===','&&!q){a.push(x);x=''}else x+=c}a.push(x);return a};
  const heads=parse(lines.shift());return lines.map(line=>Object.fromEntries(parse(line).map((v,i)=>[heads[i],v])));
}
const maybeNum=x=>x==null||x===''?null:Number.isFinite(+x)?+x:null;
export function normalizeReplay(input){
  let rows=Array.isArray(input)?input:input?.rows||input?.samples;
  if(!Array.isArray(rows))throw Error('対応するデータ配列が見つかりません');
  const mapped=rows.map(r=>{
    if(Array.isArray(r.raw))return {t:r.t_ms??r.t,raw:r.raw,gyro:r.gyro,native:r.native};
    const names=['compare_raw','raw_a'],oldGyro=r.compare_gyro_x!==undefined?'compare_gyro':'gyro';
    const vector=(prefix)=>['x','y','z'].map(k=>maybeNum(r[prefix+'_'+k]));
    const raw=names.map(vector).find(a=>a.every(Number.isFinite));
    const gyro=vector(oldGyro),native=vector(r.compare_os_input_x!==undefined?'compare_os_input':'native_a');
    const t=maybeNum(r.comparison_t_ms??r.t_ms);
    return {t,raw,gyro:gyro.every(Number.isFinite)?gyro:null,native:native.every(Number.isFinite)?native:null};
  }).filter(s=>Number.isFinite(s.t)&&s.raw?.every(Number.isFinite)&&s.gyro?.every(Number.isFinite));
  if(mapped.length<30)throw Error('使用可能な3軸加速度・角速度が30点未満です');
  mapped.sort((a,b)=>a.t-b.t);
  return mapped;
}
