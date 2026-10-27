import test from 'node:test';import assert from 'node:assert/strict';
import {GravityComparison,flattenComparison} from '../src/comparison.js';
import {Q} from '../src/math.js';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const init=()=>{const c=new GravityComparison();c.calibrate([0,0,9.80665]);return c};
test('stationary zero residual for all three modes and 3 axes',()=>{
 const c=init();for(let t=0;t<=1000;t+=10)c.update({t,raw:[0,0,9.80665],native:[0,0,0],gyro:[0,0,0]},[1,0,0,0]);
 for(const m of ['fixed','dynamic','os'])for(const f of ['device','initial'])for(const v of ['v','x'])c.integrators[`${m}_${f}`][v].forEach(x=>near(x,0));
});
test('known +90° about z maps +X device acceleration to +Y initial',()=>{
 const c=init(),q=[Math.SQRT1_2,0,0,Math.SQRT1_2];const r=c.update({t:0,raw:[1,0,9.80665],native:[1,0,0]},q);
 near(r.initial.os[0],0);near(r.initial.os[1],1);near(r.initial.os[2],0);
});
test('tilting 90° about X: fixed residual nonzero, dynamic removes gravity',()=>{
 const c=init(),q=[Math.SQRT1_2,Math.SQRT1_2,0,0],g=Q.rotate(Q.conj(q),[0,0,9.80665]);const r=c.update({t:0,raw:g,native:[0,0,0]},q);
 near(Math.hypot(...r.device.dynamic),0);assert.ok(Math.hypot(...r.device.fixed)>10);
});
test('signed trapezoids: acceleration then negative acceleration, zero velocity but nonzero displacement',()=>{
 const c=init();for(let t=0;t<=2000;t+=10){const a=t<=1000?1:-1;c.update({t,raw:[a,0,9.80665],native:[a,0,0]},[1,0,0,0])}
 const p=c.integrators.os_device;near(p.v[0],0.01,0.012);assert.ok(p.x[0]>0.8);assert.ok(p.positive[0]>0&&p.negative[0]<0);
});
test('OS missing not silently replaced, and time gap detected',()=>{
 const c=init();let r=c.update({t:0,raw:[0,0,9.80665],native:null},[1,0,0,0]);assert.equal(r.device.os,null);assert.equal(flattenComparison(r).compare_os_device_a_x,null);
 r=c.update({t:1000,raw:[0,0,9.80665],native:[0,0,0]},[1,0,0,0]);assert.equal(r.statuses.fixed_device.status,'invalid_dt');
});
