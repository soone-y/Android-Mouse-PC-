import test from 'node:test';
import assert from 'node:assert/strict';
import {G,V} from '../src/math.js';
import {MotionPipeline,parseMotionEvent} from '../src/pipeline.js';
import {exportCsv,parseSimpleCSV,normalizeReplay,GYRO_MAPPING} from '../src/recording.js';
const near=(a,b,tol=1e-3)=>assert.ok(Math.abs(a-b)<tol,`${a} !~= ${b} (tol ${tol})`);

test('W3C rotationRate alpha=X beta=Y gamma=Z and raw values retained',()=>{
  const s=parseMotionEvent({timeStamp:1800,interval:20,
    accelerationIncludingGravity:{x:0,y:0,z:G},acceleration:{x:0,y:0,z:0},
    rotationRate:{alpha:30,beta:-60,gamma:90}},1800);
  near(s.gyro[0],Math.PI/6);near(s.gyro[1],-Math.PI/3);near(s.gyro[2],Math.PI/2);
  assert.deepEqual(s.rotationRateDeg,[30,-60,90]);
});

test('pure horizontal yaw remains Z rotation; gravity removal does not invent translation',()=>{
  const p=new MotionPipeline();p.beginCalibration(0);
  let last;
  for(let i=0;i<=210;i++){
    const t=i*20,spinning=t>=2000&&t<3000;
    const s=parseMotionEvent({timeStamp:t||0,interval:20,
      accelerationIncludingGravity:{x:0,y:0,z:G},acceleration:{x:0,y:0,z:0},
      rotationRate:{alpha:0,beta:0,gamma:spinning?90:0}},t);
    last=p.consume(s,{zupt:true});
  }
  assert.equal(last.phase,'operating');
  near(last.q[2],0,.01);
  near(Math.abs(last.q[3]),Math.sin(Math.PI/4),.03);
  near(V.norm(last.aWorld.estimated),0,.02);
});

test('v10 archived CSV and JSON are remapped, new tagged CSV is not remapped',()=>{
  const oldRow='0,operating,20,0,0,9.80665,0,1.5707963267948966,0,0,0,0';
  const oldCsv='t_ms,phase,interval_ms,raw_a_x,raw_a_y,raw_a_z,gyro_x,gyro_y,gyro_z,native_a_x,native_a_y,native_a_z,tilt_error_deg\n'+
    Array.from({length:30},(_,i)=>oldRow.replace(/^0,/,String(i*20)+',')+',0').join('\n');
  const prior=normalizeReplay(parseSimpleCSV(oldCsv));
  near(prior[0].gyro[0],0);near(prior[0].gyro[1],0);near(prior[0].gyro[2],Math.PI/2);
  const newRows=Array.from({length:30},(_,i)=>({t_ms:i*20,raw:[0,0,G],gyro:[0,0,Math.PI/2],native:[0,0,0],gyroMapping:GYRO_MAPPING,rotationRateDeg:[0,0,90]}));
  const tagged=normalizeReplay(parseSimpleCSV(exportCsv(newRows)));
  near(tagged[0].gyro[1],0);near(tagged[0].gyro[2],Math.PI/2);
  const archivedJson=normalizeReplay({schema:'sensor-mouse-lab/10',rows:newRows.map(r=>({...r,gyro:[0,Math.PI/2,0],gyroMapping:undefined}))});
  near(archivedJson[0].gyro[2],Math.PI/2);
  const taggedJson=normalizeReplay({schema:'sensor-mouse-lab/10',gyroMapping:GYRO_MAPPING,rows:newRows});
  near(taggedJson[0].gyro[2],Math.PI/2);
});

test('legacy JSON calibration bias is rotated once along with samples',()=>{
  const data={schema:'sensor-mouse-lab/10',reference:{raw:[0,0,G],gyro:[0.1,0.2,0.3]},
    rows:Array.from({length:30},(_,i)=>({t_ms:i*20,raw:[0,0,G],gyro:[0,0,0],native:[0,0,0]}))};
  normalizeReplay(data);
  assert.deepEqual(data.reference.gyro,[0.3,0.1,0.2]);
  normalizeReplay(data);
  assert.deepEqual(data.reference.gyro,[0.3,0.1,0.2]);
});
