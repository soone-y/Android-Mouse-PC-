import {GravityComparison,flattenComparison} from './comparison.js';
import {createComparisonUI} from './comparison-ui.js';
import {MotionPipeline,parseMotionEvent} from './pipeline.js';
import {Recorder,parseCsv,replayRows,exportCsv,download} from './diagnostics.js';
import {TrackPair} from './integration.js';
import {Plotter} from './visualization.js';
import {MotionHistory,liveGraphFrame,graphSeries} from './timeseries.js';
import {TimeChart} from './charts.js';
const comparison=new GravityComparison();
const comparisonUI=createComparisonUI(comparison);
const $=id=>document.getElementById(id),engine=new MotionPipeline(),recorder=new Recorder(),plot=new Plotter($('plane'));
const history=new MotionHistory(),accChart=new TimeChart($('accGraph'),{title:'平面加速度',unit:'m/s²',key:'acc'}),velChart=new TimeChart($('velocityGraph'),{title:'推定速度',unit:'cm/s',key:'velocity'});
const tracks=['fixed_free','fixed_constrained','native_free','native_constrained','estimated_free','estimated_constrained'];
// Add fixed gravity choices to the existing selector.
for(const key of ['fixed_free','fixed_constrained']){
 if(![...$('track').options].some(o=>o.value===key)){
  const opt=document.createElement('option');opt.value=key;
  opt.textContent=key==='fixed_free'?'固定重力・補正なし':'固定重力・静止補正';$('track').append(opt);
 }
}
const settings=()=>({zupt:$('zupt').checked,matchThreshold:Number($('threshold').value)/100,scale:Number($('scale').value),flipY:$('flipY').checked,track:$('track').value});
let sensorActive=false,loadedRows=null,replayed=null,lastOutput=null,currentSource='live',trial=null,simulated=null,lastRecordUi=0;
let paths=Object.fromEntries(tracks.map(key=>[key,[]]));const now=()=>performance.now();
function status(message,warn=false){$('status').textContent=message;$('status').classList.toggle('warn',warn)}
function recordingStatus(){const n=recorder.samples.length;$('recordInfo').textContent=recorder.active?`● 記録中：${n.toLocaleString()}点 / ${recorder.events.length}イベント`:`■ ${n.toLocaleString()}点 / ${recorder.events.length}イベント（最大${recorder.max.toLocaleString()}点）`;for(const id of ['csv','json'])$(id).disabled=!n;$('recordStart').disabled=recorder.active;$('recordStop').disabled=!recorder.active}
function clearPaths(){history.clear();paths=Object.fromEntries(tracks.map(key=>[key,[]]));plot.center([0,0]);lastOutput=null}
function displayTracks(){if(currentSource==='replay'&&replayed)return {main:replayed.paths.event,comparison:[replayed.paths.nominal,replayed.paths.constrained]};const selected=settings().track;const [src,mode]=selected.split('_');const available=paths[selected].length>0?selected:('estimated_'+mode);return {main:paths[available]||[],comparison:paths[(available.startsWith('native')?'estimated':'native')+'_'+mode]||[]}}
function addOutput(f){if(!f||f.phase!=='operating')return;lastOutput=f;history.append(liveGraphFrame(f));
 for(const src of ['fixed','native','estimated'])for(const mode of ['free','constrained']){const p=f.tracks[src][mode],key=src+'_'+mode;if(src==='native'&&!f.anchoredNative)continue;let path=paths[key];if(!path.length||Math.hypot(p.x[0]-path.at(-1)[0],p.x[1]-path.at(-1)[1])>.00007){path.push(p.x.slice());if(path.length>1200)path.shift()}}
}
let lastGraphRendered=0;
function drawGraphs(){comparisonUI.draw();
 const source=currentSource==='replay'?'replay':'live';const dataset=source==='replay'?replayHistory:history;
 const graph=graphSeries(dataset,{context:source,track:settings().track,axis:$('graphAxis').value,windowSeconds:$('graphWindow').value,replayTrack:$('graphReplayTrack').value,overlayFree:$('graphComparison').checked});
 accChart.setData(graph);velChart.setData(graph);
 $('graphReplayOption').hidden=source!=='replay';
 $('graphComparison').parentElement.lastChild.textContent=source==='replay'?'受信時刻・補正なし速度を破線で比較':'補正なし速度を破線で比較';
 $('graphInfo').textContent=graph.rows?`${source==='replay'?'CSV再生':currentSource==='simulation'?'模擬入力':'センサー実測'} / ${graph.rows.toLocaleString()}サンプル / ${graph.first.toFixed(2)}〜${graph.end.toFixed(2)}秒${graph.missing?' / 選択系列に有効な加速度なし':''}`:'センサー取得、模擬運動、またはCSV再生でグラフを表示します。';
}
const replayHistory=new MotionHistory(16000);
for(const id of ['graphWindow','graphAxis','graphReplayTrack','graphComparison'])$(id).addEventListener('change',drawGraphs);
$('track').addEventListener('change',drawGraphs);
window.addEventListener('resize',drawGraphs);
let lastRendered=0;function updateFrame(t=now()){if(t-lastRendered<32){requestAnimationFrame(updateFrame);return}lastRendered=t;if(t-lastGraphRendered>=110){drawGraphs();lastGraphRendered=t}const {main,comparison}=displayTracks();plot.draw(main,comparison,settings().scale,settings().flipY);
 let pos=[0,0],vel=[0,0],free=[0,0],acc=[0,0],evidence='—';
 if(currentSource==='replay'&&replayed){pos=replayed.event.position;vel=replayed.event.velocity;free=vel;evidence=`記録済み ${replayed.applied}点`}
 else if(currentSource==='simulation'&&simulated){const selected=settings().track.split('_')[1];const p=simulated[selected]||simulated.free;pos=p.x;vel=p.v;free=simulated.free.v;evidence='模擬入力'}
 else if(lastOutput){const [src,mode]=settings().track.split('_');const actualSrc=src==='native'&&!lastOutput.anchoredNative?'estimated':src;const choice=lastOutput.tracks[actualSrc];pos=choice[mode].x;vel=choice[mode].v;free=choice.free.v;acc=(actualSrc==='native'?lastOutput.anchoredNative:actualSrc==='fixed'?lastOutput.anchoredFixed:lastOutput.anchoredEstimated)?.slice(0,2)||[0,0];evidence=lastOutput.stationaryEvidence?'一致':'不一致'}
 $('x').textContent=(pos[0]*100).toFixed(2);$('y').textContent=(pos[1]*100).toFixed(2);$('speed').textContent=(Math.hypot(...vel)*100).toFixed(2);$('freeSpeed').textContent=(Math.hypot(...free)*100).toFixed(2);$('acceleration').textContent=acc.map(v=>v.toFixed(2)).join(', ');$('evidence').textContent=evidence;
 requestAnimationFrame(updateFrame)}
requestAnimationFrame(updateFrame);
function handleMotion(e){if(!sensorActive)return;const t=now(),sample=parseMotionEvent(e,t);const output=engine.consume(sample,settings());
 const diagnostic=comparison.reference?comparison.update(sample,output?.phase==='operating'?output.q:null):null;
 recorder.add(t,sample,output,diagnostic);if(output?.phase==='operating'){currentSource='live';addOutput(output);if(!output.anchoredNative&&output.t<2000){status('OSの重力除去済み加速度が取得できないため、独自推定を表示します。',true)}}
 if(output?.phase==='calibrated'){
  comparison.calibrate(engine.detector.ref.raw);recorder.calibration=engine.detector.ref;recorder.mark(t,'calibration_done',{ref:engine.detector.ref});
  $('calInfo').textContent=`補正完了：${engine.detector.ref.count}件 / 加速度標準偏差 ${engine.detector.ref.noiseA.toFixed(3)} m/s² / 角速度標準偏差 ${engine.detector.ref.noiseG.toFixed(4)} rad/s`;
  status('静止補正が完了しました。移動を開始できます。')
 }else if(output?.phase==='calibration_failed'){recorder.mark(t,'calibration_failed',{reason:output.message});status(output.message,true)}
 if(t-lastRecordUi>250){recordingStatus();lastRecordUi=t}}
async function startSensor(){if(sensorActive)return;if(!window.isSecureContext){status('HTTPSまたはlocalhostで開いてください',true);return}if(typeof DeviceMotionEvent==='undefined'){status('このブラウザはDeviceMotionEventに非対応です',true);return}
 try{if(typeof DeviceMotionEvent.requestPermission==='function'){const granted=await DeviceMotionEvent.requestPermission();if(granted!=='granted')throw Error('センサー許可が得られませんでした')}
  sensorActive=true;engine.reset();comparison.reset();clearPaths();currentSource='live';window.addEventListener('devicemotion',handleMotion);status('センサー取得中。動かさず「静止補正」を押してください。');}
 catch(e){status(`センサー開始失敗：${e.message}`,true)}}
function stopSensor(){sensorActive=false;window.removeEventListener('devicemotion',handleMotion);status('センサー停止。記録は保持されています。')}
$('sensorStart').onclick=startSensor;$('sensorStop').onclick=stopSensor;
$('calibrate').onclick=()=>{if(!sensorActive){status('先にセンサーを開始してください',true);return}const t=now();engine.beginCalibration(t);comparison.reset();clearPaths();currentSource='live';recorder.mark(t,'calibration_start');status('約1.2秒間静止させてください。')};
$('reset').onclick=()=>{engine.reset();comparison.reset();clearPaths();currentSource='live';recorder.mark(now(),'reset');status('座標・補正状態をリセットしました。再補正してください。')};
$('center').onclick=()=>{const rows=displayTracks().main;plot.center(rows.at(-1)||[0,0])};$('clearTrace').onclick=()=>{clearPaths();if(replayed)replayed.paths={event:[],nominal:[],constrained:[]};recorder.mark(now(),'trace_cleared')};
$('recordStart').onclick=()=>{recorder.start(now(),settings());recorder.calibration=engine.detector.ref;recordingStatus()};$('recordStop').onclick=()=>{recorder.stop(now());recordingStatus()};$('discard').onclick=()=>{recorder.clear();recordingStatus()};
$('csv').onclick=()=>download(exportCsv(recorder.snapshot()),`sensor-mouse-v7-${Date.now()}.csv`,'text/csv;charset=utf-8');
$('json').onclick=()=>download(JSON.stringify(recorder.snapshot(),null,2),`sensor-mouse-v7-${Date.now()}.json`,'application/json;charset=utf-8');
function getSelectedPosition(){if(currentSource==='replay'&&replayed)return replayed.event.position;const [src,mode]=settings().track.split('_');if(currentSource==='simulation'&&simulated)return simulated[mode].x;if(!lastOutput)return [0,0];return lastOutput.tracks[src==='native'&&!lastOutput.anchoredNative?'estimated':src][mode].x}
$('markStart').onclick=()=>{trial={t:now(),p:getSelectedPosition().slice()};recorder.mark(now(),'trial_start',{position_m:trial.p});$('trialInfo').textContent='開始位置を記録しました'};
$('markStop').onclick=()=>{if(!trial){$('trialInfo').textContent='先に開始マークを押してください';return}const p=getSelectedPosition(),dx=(p[0]-trial.p[0])*100,dy=(p[1]-trial.p[1])*100,ax=$('actualX').value,ay=$('actualY').value,measured=ax!==''&&ay!=='';const error=measured?Math.hypot(dx-Number(ax),dy-Number(ay)):null;const out={estimated_dx_cm:dx,estimated_dy_cm:dy,measured_dx_cm:measured?Number(ax):null,measured_dy_cm:measured?Number(ay):null,error_cm:error};recorder.mark(now(),'trial_end',out);$('trialInfo').textContent=`推定 X ${dx.toFixed(2)}cm / Y ${dy.toFixed(2)}cm${measured?` ｜実測誤差 ${error.toFixed(2)}cm`:''}`;trial=null};
for(const id of ['threshold','scale'])$(id).oninput=()=>{$(id+'Value').textContent=id==='scale'?$('scale').value+' px/m':(+$('threshold').value/100).toFixed(2)+' m/s²';recorder.mark(now(),'setting_changed',{id,value:$(id).value})};for(const id of ['track','zupt','flipY'])$(id).onchange=()=>recorder.mark(now(),'setting_changed',{id,value:$(id).type==='checkbox'?$(id).checked:$(id).value});
$('importCsv').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{loadedRows=parseCsv(await file.text());$('replayInfo').textContent=`${file.name} / ${loadedRows.length.toLocaleString()}行。再生可能です。`;$('replay').disabled=false}catch(error){$('replayInfo').textContent='読み込み失敗：'+error.message;$('replay').disabled=true}};
function reprocess(){if(!loadedRows)return;try{replayed=replayRows(loadedRows,{source:$('replaySource').value});replayHistory.clear();for(const row of replayed.graphRows)replayHistory.append(row);currentSource='replay';drawGraphs();plot.center([0,0]);$('replayInfo').textContent=`${replayed.samples}サンプルを再積分 / 使用列：${replayed.columns.join(', ')} / ギャップ ${replayed.gap}件 / 静止一致 ${replayed.applied}件\n${replayed.note}`;
 const values=[['受信時刻で積分',replayed.event],['e.intervalで積分',replayed.nominal],['記録済み静止判定を適用',replayed.constrained]];
 $('replayResults').replaceChildren(...values.map(([title,result])=>{const div=document.createElement('div'),label=document.createElement('b'),detail=document.createElement('span');label.textContent=title;detail.textContent=`終点 X ${(result.position[0]*100).toFixed(1)}cm, Y ${(result.position[1]*100).toFixed(1)}cm / 速度 ${(Math.hypot(...result.velocity)*100).toFixed(1)}cm/s`;div.append(label,detail);return div}));
 }catch(e){$('replayInfo').textContent=`再生エラー：${e.message}`}}
$('replay').onclick=reprocess;$('replaySource').onchange=()=>{if(loadedRows)reprocess()};
function simulation(roundTrip){stopSensor();engine.reset();clearPaths();replayed=null;currentSource='simulation';const a=new TrackPair();const t0=now(),duration=roundTrip?2:1;for(let step=0;step<=duration/.01;step++){
 const t=step*.01;const acc=2*Math.sin(2*Math.PI*t)*(roundTrip&&t>=1?-1:1);
 a.update(t0+t*1000,[acc,0],false);history.append({t:t0+t*1000,acc:{fixed:[acc,0],native:[acc,0],estimated:[acc,0]},velocities:{native_free:a.free.v.slice(),native_constrained:a.constrained.v.slice(),estimated_free:a.free.v.slice(),estimated_constrained:a.constrained.v.slice(),fixed_free:a.free.v.slice(),fixed_constrained:a.constrained.v.slice()}});const f=a.free.x.slice(),c=a.constrained.x.slice();paths.native_free.push(f);paths.native_constrained.push(c);paths.estimated_free.push(f);paths.estimated_constrained.push(c);paths.fixed_free.push(f);paths.fixed_constrained.push(c);
 }
 simulated={free:a.free,constrained:a.constrained};plot.center([0,0]);status(`模擬${roundTrip?'往復':'前進・停止'}完了：理論上の最終速度 0 m/s${roundTrip?'、最終位置 0 m':'、正の位置に停止'}。`);recorder.mark(now(),'simulated',{roundTrip});}
$('simulate').onclick=()=>simulation(false);$('simulateRound').onclick=()=>simulation(true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(recorder.active)recorder.stop(now(),'page_hidden');stopSensor();recordingStatus()}});
recordingStatus();drawGraphs();
