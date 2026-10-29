import test from 'node:test';
import assert from 'node:assert/strict';
const defaults={source:'native',integrator:'constrained',axis:'x',window:'12',scale:'1300'};
function createElement(id){
  const context={setTransform(){},clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},arc(){},fill(){}};
  return {id,value:defaults[id]??'',checked:id==='zupt',disabled:false,textContent:'',classList:{add(){},remove(){},toggle(){}},
    getContext:()=>context,getBoundingClientRect:()=>({width:680,height:270}),addEventListener(){},setPointerCapture(){},
    clientWidth:680,clientHeight:270};
}
test('UI wiring can initialize and run mock-sensor simulation without runtime exceptions', async()=>{
  const map=new Map();const d={getElementById:id=>{if(!map.has(id))map.set(id,createElement(id));return map.get(id)},addEventListener(){},hidden:false};
  globalThis.document=d;
  globalThis.window={addEventListener(){}};
  globalThis.devicePixelRatio=1;
  globalThis.requestAnimationFrame=()=>0;
  await import('../src/app.js');
  assert.equal(typeof map.get('simulate').onclick,'function');
  map.get('simulate').onclick();
  assert.match(map.get('replayInfo').textContent,/36cm/);
  assert.match(map.get('replayInfo').textContent,/独自推定 36/);
});
