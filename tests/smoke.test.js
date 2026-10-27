import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionPipeline} from '../src/pipeline.js';
import {OrientationEstimator} from '../src/imu.js';
import {liveGraphFrame, graphSeries} from '../src/timeseries.js';
import {TrackPair} from '../src/integration.js';
const G=9.80665;
test('no drift in stationary gyro bias estimate',()=>{
 const o=new OrientationEstimator();o.calibrate([0,0,G],[0,0,0]);
 for(let t=0;t<=15000;t+=20)o.update({t,raw:[0,0,G],gyro:[0.02,-0.015,0],stationary:true});
 assert.ok(Math.abs(o.gravity()[0])<1e-4);
 assert.ok(Math.abs(o.gravity()[1])<1e-4);
});
test('fixed and dynamic channels are both present in runtime graph',()=>{
 const m=new MotionPipeline();m.beginCalibration(0);
 for(let t=0;t<=1220;t+=20)m.consume({t,raw:[0,0,G],gyro:[0,0,0],native:[0,0,0]});
 let f=m.consume({t:1240,raw:[1,0,G],gyro:[0,0,0],native:[1,0,0]});
 assert.equal(f.phase,'operating');
 assert.ok(Array.isArray(f.anchoredFixed));
 const graph=liveGraphFrame(f);
 assert.ok(Array.isArray(graph.acc.fixed));
 assert.ok(Array.isArray(graph.velocities.fixed_free));
 const rendered=graphSeries({rows:[graph]},{track:'fixed_free'});
 assert.equal(rendered.acc.length,2);
});
test('pure integrator still accumulates residual and ZUPT only affects constrained',()=>{
 const t=new TrackPair();t.update(0,[0.1,0],false);t.update(100,[0.1,0],true);
 assert.ok(t.free.v[0]>0);
 assert.equal(t.constrained.v[0],0);
});
