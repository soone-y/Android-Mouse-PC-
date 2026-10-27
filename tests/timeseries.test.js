import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionHistory,graphSeries,liveGraphFrame} from '../src/timeseries.js';
import {replayRows,parseCsv} from '../src/diagnostics.js';

test('bounded time series stores only increasing timestamps',()=>{
 const h=new MotionHistory(3);for(let t=0;t<=4;t++)h.append({t});
 assert.equal(h.length,3);assert.deepEqual(h.rows.map(x=>x.t),[2,3,4]);assert.equal(h.append({t:4}),false);
});
test('X/Y acceleration and velocity are tracked separately without altering units',()=>{
 const h=new MotionHistory();h.append({t:1000,acc:{native:[2,-3],estimated:[4,-5]},velocities:{native_constrained:[.2,-.3],native_free:[.25,-.35],estimated_free:[.1,.2],estimated_constrained:[.1,.2]}});
 const g=graphSeries(h,{track:'native_constrained'});
 assert.deepEqual(g.acc.map(x=>x.y),[2,-3]);assert.deepEqual(g.velocity.map(x=>x.y),[20,-30]);assert.deepEqual(g.comparison.map(x=>x.y),[25,-35]);
 assert.equal(graphSeries(h,{axis:'y'}).velocity.length,1);
});
test('window choice does not affect underlying samples',()=>{
 const h=new MotionHistory();for(let i=0;i<25;i++)h.append({t:i*1000,acc:{native:[1,1]},velocities:{native_constrained:[1,1],native_free:[1,1]}});
 assert.equal(graphSeries(h,{windowSeconds:5}).rows,6);assert.equal(graphSeries(h,{windowSeconds:'all'}).rows,25);assert.equal(h.length,25);
});
test('live frame copies velocity data for stable history',()=>{
 const tracks={native:{free:{v:[1,2]},constrained:{v:[3,4]}},estimated:{free:{v:[5,6]},constrained:{v:[7,8]}}};
 const row=liveGraphFrame({phase:'operating',t:100,anchoredNative:[.1,.2,0],anchoredEstimated:[.3,.4,0],tracks});
 tracks.native.free.v[0]=99;assert.equal(row.velocities.native_free[0],1);
});
test('CSV replay graph velocities use same integrator results',()=>{
 const rows=parseCsv('t_ms,kind,interval_ms,anchor_native_x,anchor_native_y,matched\n0,sample,10,1,0,0\n10,sample,10,1,0,0\n20,sample,10,0,0,1\n');
 const replay=replayRows(rows);assert.equal(replay.graphRows.length,3);
 assert.equal(replay.graphRows.at(-1).eventV[0],replay.event.velocity[0]);
 assert.equal(replay.graphRows.at(-1).constrainedV[0],0);
});
