import {MotionPipeline,parseMotionEvent} from './pipeline.js';
import {Recorder,SOURCES,exportCsv,saveDownload,parseSimpleCSV,normalizeReplay} from './recording.js';
import {correctRestToRest} from './integration.js';
import {Q,V,G} from './math.js';
import {Plotter,SeriesPlot} from './plot.js';

const $=id=>document.getElementById(id);
const engine=new MotionPipeline(),recorder=new Recorder(),plot=new Plotter($('plane'));
const graphs={acc:new SeriesPlot($('accGraph')),vel:new SeriesPlot($('velGraph')),diff:new SeriesPlot($('diffGraph'))};
let live=false,lastSample=null,lastFrame=null,history=[],loaded=null,gesture=null,paths={estimated:[],native:[],fixed:[]};
let lastUi=0,needPaint=true,sourceContext='live',nativeWarned=false;
const config=()=>({zupt:$('zupt').checked});
const chosen=()=>({source:$('source').value,mode:$('integrator').value});
const available=()=>lastFrame?.aWorld?.[$('source').value]!=null;
const status=(text,isError=false)=>{$('status').textContent=text;$('status').classList.toggle('error',isError)};
const num=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'—';
const clearView=()=>{
  history=[];lastFrame=null;paths={estimated:[],native:[],fixed:[]};gesture=null;needPaint=true;
  $('gestureResult').textContent='区間未指定';
  for(const id of ['x','y','speed','residual','quiet','tiltError','corrections','gaps'])$(id).textContent='—';
  plot.draw(paths,chosen().source,Number($('scale').value));
  for(const graph of Object.values(graphs))graph.draw([]);
};
function compact(frame){
  if(frame?.phase!=='operating')return null;
  const tracks={};
  for(const source of SOURCES){tracks[source]={free:frame.tracks[source].free.snapshot(),constrained:frame.tracks[source].constrained.snapshot()}}
  return {phase:'operating',t:frame.t,raw:frame.raw.slice(),gyro:frame.gyro.slice(),native:frame.native?.slice()||null,
    gravityBody:frame.gravityBody.slice(),osEstimatedResidual:frame.osEstimatedResidual?.slice()||null,
    q:frame.q.slice(),aWorld:Object.fromEntries(SOURCES.map(s=>[s,frame.aWorld[s]?.slice()||null])),
    tracks,tiltInnovationDeg:frame.tiltInnovationDeg,quiet:{...frame.quiet},zupt:frame.zupt,
    orientationStats:{...frame.orientationStats}};
}
function addFrame(frame){
  const row=compact(frame);if(!row)return;
  history.push(row);if(history.length>10000)history.splice(0,history.length-10000);
  lastFrame=row;
  const {mode}=chosen();
  for(const source of SOURCES)if(row.aWorld[source]){
    const point=row.tracks[source][mode].x.slice();const p=paths[source];
    if(!p.length||Math.hypot(point[0]-p.at(-1)[0],point[1]-p.at(-1)[1])>.0001){p.push(point);if(p.length>7000)p.shift()}
  }
  needPaint=true;
}
function paint(){
  if(!lastFrame)return;
  const {source,mode}=chosen(),tr=lastFrame.tracks[source][mode];
  if(!lastFrame.aWorld[source]){
    $('x').textContent='—';$('y').textContent='—';$('speed').textContent='—';
  }else{
    $('x').textContent=num(tr.x[0]*100);$('y').textContent=num(tr.x[1]*100);
    $('speed').textContent=num(Math.hypot(...tr.v)*100);
  }
  $('residual').textContent=num(lastFrame.osEstimatedResidual?Math.hypot(...lastFrame.osEstimatedResidual):null,3);
  $('quiet').textContent=lastFrame.quiet.quiet?'候補あり':lastFrame.quiet.pass?'判定待ち':'候補なし';
  $('tiltError').textContent=num(lastFrame.tiltInnovationDeg,2)+'°';
  $('corrections').textContent=String(lastFrame.orientationStats.corrected);
  $('gaps').textContent=String(lastFrame.orientationStats.gaps);
  plot.draw(paths,source,Number($('scale').value));
  const axis=$('axis').value,windowSec=Number($('window').value);
  const frame={source,axis,windowSec};
  // Bound chart work even during lengthy recordings.
  const chartRows=history.length>1600?history.filter((_,i)=>i%Math.ceil(history.length/1600)===0||i===history.length-1):history;
  graphs.acc.draw(chartRows,{...frame,quantity:'acceleration'});
  graphs.vel.draw(chartRows,{...frame,quantity:'velocity'});
  graphs.diff.draw(chartRows,{...frame,quantity:'residual'});
}
function uiLoop(t){
  if(t-lastUi>110 && needPaint){lastUi=t;paint();needPaint=false}
  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);
function onMotion(e){
  if(!live)return;
  const s=parseMotionEvent(e,performance.now());lastSample=s;
  const result=engine.consume(s,config());recorder.record(s,result);
  if(result.phase==='operating'){addFrame(result);sourceContext='live';
    if(!result.native&&!nativeWarned){nativeWarned=true;status('OS補正済み加速度を取得できません。独自方式を選択してください。',true)}
  }
  else if(result.phase==='calibrated'){
    $('calInfo').textContent=`校正成功：${result.reference.count}点、重力 ${num(result.reference.g,4)} m/s²、生値の変動 ${num(result.reference.rawScatter,4)} m/s²、ジャイロ変動 ${num(result.reference.gyroScatter,4)} rad/s`;
    status('校正成功。移動できます。静止のまま姿勢を変えても、静止候補の判定は初期角度に依存しません。');
  }else if(result.phase==='calibration_failed'){status(result.reason,true);$('calInfo').textContent='校正に失敗しました。再実行してください。'}
  else if(result.phase==='gap')status(`サンプリング欠落（${num(result.dt*1000,1)} ms）。欠落時間を積分しません。`,true);
}
async function start(){
  if(live)return;
  if(!isSecureContext){status('HTTPSまたはlocalhostから開いてください。',true);return}
  if(typeof DeviceMotionEvent==='undefined'){status('この端末のブラウザはDeviceMotionEventを提供していません。',true);return}
  try{
    if(typeof DeviceMotionEvent.requestPermission==='function'){
      const result=await DeviceMotionEvent.requestPermission();if(result!=='granted')throw Error('センサー取得が許可されませんでした');
    }
    live=true;nativeWarned=false;engine.reset();clearView();sourceContext='live';window.addEventListener('devicemotion',onMotion);
    status('センサーを取得中。スマホを置き、「静止校正」を実行してください。');
  }catch(e){status('取得失敗：'+e.message,true)}
}
function stop(){if(!live)return;live=false;window.removeEventListener('devicemotion',onMotion);recorder.stop(performance.now());status('取得停止。最後の計測結果は表示したままです。')}
$('start').onclick=start;$('stop').onclick=stop;
$('calibrate').onclick=()=>{
  if(!live){status('センサーを開始してから校正してください。',true);return}
  engine.beginCalibration(performance.now());clearView();
  status('校正中：1.5秒間、スマホを静止させてください。角度は水平でなくても構いません。');
  recorder.mark(performance.now(),'calibration_start');
};
$('reset').onclick=()=>{engine.reset();clearView();status('推定リセット完了。再校正してください。')};
$('confirmRest').onclick=()=>{
  if(!lastFrame||!live){$('restNotice').textContent='実測中かつ校正済みの場合のみ利用できます。';return}
  engine.confirmRest(lastSample);
  // explicitly annotate position graph at the latest sample, retaining free channels untouched.
  for(const s of SOURCES)lastFrame.tracks[s].constrained.v=[0,0];
  $('restNotice').textContent='手動で速度ゼロを確定しました。位置は変更していません。';
  recorder.mark(performance.now(),'manual_confirm_rest');needPaint=true;
};
$('center').onclick=()=>{const {source}=chosen();plot.center(paths[source].at(-1)||[0,0]);needPaint=true};
$('clearPath').onclick=()=>{paths={estimated:[],native:[],fixed:[]};needPaint=true};
for(const id of ['source','integrator','axis','window','scale'])$(id).oninput=()=>{$('scaleValue').textContent=$('scale').value+' px/m';
  if(id==='source'||id==='integrator'){
    const {mode}=chosen();paths=Object.fromEntries(SOURCES.map(s=>[s,history.filter(r=>r.aWorld[s]).map(r=>r.tracks[s][mode].x.slice())]));
  }
  needPaint=true;
};
$('zupt').onchange=()=>{
  status($('zupt').checked?'ZUPTを有効にしました（静止と等速移動の混同に注意）':'ZUPTを無効にしました。純粋積分は常に維持されます。');
};
$('recordStart').onclick=()=>{if(!live||!engine.reference){status('校正完了後に記録を開始してください。',true);return}
  recorder.start(performance.now(),engine.reference);$('recordInfo').textContent='記録中…';status('記録開始');};
$('recordStop').onclick=()=>{recorder.stop(performance.now());$('recordInfo').textContent=`記録終了：${recorder.rows.length}点 / JSONとCSVに出力できます。`};
$('exportJson').onclick=()=>{if(!recorder.rows.length){status('記録がありません',true);return}saveDownload(JSON.stringify(recorder.json(),null,2),'sensor-mouse-lab-v10.json','application/json')};
$('exportCsv').onclick=()=>{if(!recorder.rows.length){status('記録がありません',true);return}saveDownload(exportCsv(recorder.rows),'sensor-mouse-lab-v10.csv','text/csv;charset=utf-8')};
$('gestureStart').onclick=()=>{
  if(!lastFrame){$('gestureResult').textContent='測定を開始してください。';return}
  const {source}=chosen();if(!lastFrame.aWorld[source]){$('gestureResult').textContent='選択した方式に入力データがありません。';return}
  gesture={i:history.length-1,source,restAtStart:lastFrame.quiet.quiet};
  $('gestureResult').textContent=`開始位置を登録（方式：${source}）。現在の静止候補：${gesture.restAtStart?'あり':'なし'}。終了時にも確実に静止してください。`;
  recorder.mark(lastFrame.t,'gesture_start',{source});
};
$('gestureEnd').onclick=()=>{
  if(!gesture){$('gestureResult').textContent='開始マークを押してください。';return}
  if(!lastFrame){return}
  const rows=history.slice(gesture.i).filter(r=>r.aWorld[gesture.source]);
  try{
    const result=correctRestToRest(rows.map(r=>({t:r.t,a:r.aWorld[gesture.source].slice(0,2)})));
    const start=rows[0].tracks[gesture.source].free.x,end=rows.at(-1).tracks[gesture.source].free.x;
    const rawDisp=end.map((v,i)=>v-start[i]);
    $('gestureResult').textContent=`区間 ${num(result.seconds,2)} 秒 / ${rows.length}点\n`+
      `速度ゼロ境界で推定した加速度バイアス：X ${num(result.bias[0],4)}, Y ${num(result.bias[1],4)} m/s²\n`+
      `補正前の変位：X ${num(rawDisp[0]*100,2)}, Y ${num(rawDisp[1]*100,2)} cm\n`+
      `補正後の区間変位：X ${num(result.displacement[0]*100,2)}, Y ${num(result.displacement[1]*100,2)} cm\n`+
      `開始/終了の静止候補：${gesture.restAtStart?'あり':'なし'} / ${lastFrame.quiet.quiet?'あり':'なし'}（候補は静止の証明ではありません）`;
    recorder.mark(lastFrame.t,'gesture_end',{...result,source:gesture.source});
  }catch(e){$('gestureResult').textContent='区間補正を計算できません：'+e.message}
  gesture=null;
};
$('importFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    loaded=file.name.toLowerCase().endsWith('.json')?JSON.parse(await file.text()):parseSimpleCSV(await file.text());
    const samples=normalizeReplay(loaded);$('replayInfo').textContent=`${file.name}：有効な生データ ${samples.length}点。再計算できます。`;
  }catch(error){loaded=null;$('replayInfo').textContent='読み込み失敗：'+error.message}
};
$('replay').onclick=()=>{
  if(!loaded){$('replayInfo').textContent='ファイルを選択してください。';return}
  const samples=normalizeReplay(loaded);stop();engine.reset();clearView();
  // New-format files carry a verified initial stationary reference; old CSV does not.
  if(loaded.reference?.raw&&loaded.reference?.gyro){
    engine.orientation.calibrate(loaded.reference.raw,loaded.reference.gyro);
    engine.reference=loaded.reference;
  }else engine.beginCalibration(samples[0].t);
  let started=0,calibrated=0,failed=0,gaps=0;
  for(const s of samples){const out=engine.consume(s,config());if(out.phase==='operating'){addFrame(out);started++}
    else if(out.phase==='calibrated')calibrated++;
    else if(out.phase==='calibration_failed')failed++;
    else if(out.phase==='gap')gaps++;
  }
  if(!started){$('replayInfo').textContent='再計算失敗：冒頭が静止していない可能性があります。初期校正に使える記録が必要です。';return}
  sourceContext='replay';$('replayInfo').textContent=`再計算完了 ${started}点（校正${calibrated}件、失敗${failed}件、ギャップ${gaps}件）。旧データは新しい重力補正アルゴリズムで再計算しました。`;
  status('オフライン再計算結果を表示中。実センサーの取得は停止しています。');needPaint=true;
};
$('simulate').onclick=()=>{
  stop();engine.reset();clearView();const t0=1000;engine.beginCalibration(t0);
  const worldA=t=>t<2?0:t<2.3?4:t<2.6?-4:0; // 0.3s accelerate, 0.3s decelerate: ~0.36m
  const n=400,dt=.02;let good=0;
  for(let i=0;i<=n;i++){
    const t=i*dt,a=worldA(t),stationary= i*dt<1.8||i*dt>2.9;
    const s={t:t0+t*1000,raw:[a,0,G],gyro:[0,0,0],native:[a,0,0],interval:dt*1000};
    const out=engine.consume(s,config());if(out.phase==='operating'){addFrame(out);good++}
  }
  const dx=lastFrame?.tracks.estimated.free.x[0];
  $('replayInfo').textContent=`模擬試験：水平で0.3秒加速→0.3秒減速。理論変位36cm、独自推定 ${num(dx*100)} cm (${good}点)。`;
  status('模擬データの解析結果を表示しています。センサーは未使用。');needPaint=true;
};
window.addEventListener('resize',()=>needPaint=true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
$('scaleValue').textContent=$('scale').value+' px/m';
