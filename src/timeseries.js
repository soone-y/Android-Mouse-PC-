/** Bounded, unit-preserving time series. t is milliseconds; accelerations m/s², velocities m/s. */
export class MotionHistory {
 constructor(max=8000){this.max=max;this.clear()}
 clear(){this.rows=[];this.first=null}
 append(row){
  if(!Number.isFinite(row?.t))return false;
  if(this.rows.length&&row.t<=this.rows.at(-1).t)return false;
  if(this.first===null)this.first=row.t;
  this.rows.push(row);
  if(this.rows.length>this.max)this.rows.splice(0,this.rows.length-this.max);
  return true;
 }
 get length(){return this.rows.length}
}
const finite2=a=>Array.isArray(a)&&a.length>=2&&a.slice(0,2).every(Number.isFinite);
export function liveGraphFrame(frame){
 if(frame?.phase!=='operating')return null;
 const velocities={};for(const src of ['native','estimated'])for(const mode of ['free','constrained']){
  velocities[src+'_'+mode]=src==='native'&&!finite2(frame.anchoredNative)?null:frame.tracks[src][mode].v.slice();
 }
 return {t:frame.t,acc:{native:finite2(frame.anchoredNative)?frame.anchoredNative.slice(0,2):null,estimated:frame.anchoredEstimated.slice(0,2)},velocities};
}
export function graphSeries(history,{track='native_constrained',axis='both',windowSeconds=15,context='live',replayTrack='event',overlayFree=true}={}){
 const all=history?.rows||[];if(!all.length)return {times:[],acc:[],velocity:[],comparison:[],first:0,end:0,missing:false};
 const last=all.at(-1).t,first=windowSeconds==='all'?all[0].t:Math.max(all[0].t,last-Number(windowSeconds)*1000);
 const [source,mode]=track.split('_');const keepAxis=axis==='x'?[0]:axis==='y'?[1]:[0,1];const sliced=all.filter(p=>p.t>=first);
 const getData=p=>{
  if(context==='replay')return {acc:p.acc,velocity:p[replayTrack+'V'],comparison:p.eventV};
  const src=source==='native'&&!finite2(p.acc?.native)?'estimated':source;
  return {acc:p.acc?.[src],velocity:p.velocities?.[src+'_'+mode],comparison:p.velocities?.[src+'_free']};
 };
 const acc=[],velocity=[],comparison=[];
 for(const p of sliced){const d=getData(p),t=(p.t-all[0].t)/1000;
  for(const i of keepAxis){acc.push({t,y:finite2(d.acc)?d.acc[i]:null,axis:i});velocity.push({t,y:finite2(d.velocity)?d.velocity[i]*100:null,axis:i});if(overlayFree)comparison.push({t,y:finite2(d.comparison)?d.comparison[i]*100:null,axis:i})}
 }
 return {acc,velocity,comparison,first:(first-all[0].t)/1000,end:(last-all[0].t)/1000,axes:keepAxis,missing:acc.every(p=>p.y===null),rows:sliced.length};
}
