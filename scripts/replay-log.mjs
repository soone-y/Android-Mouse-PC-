// Usage: node scripts/replay-log.mjs /path/to/comparison.csv
// Reprocess all raw samples with the CURRENT implementation.
import {readFileSync} from 'node:fs';
import {MotionPipeline} from '../src/pipeline.js';
import {parseSimpleCSV,normalizeReplay,SOURCES} from '../src/recording.js';
const path=process.argv[2];if(!path){console.error('usage: node scripts/replay-log.mjs path/to/old.csv-or-json');process.exit(2)}
const data=readFileSync(path,'utf8');const parsed=path.toLowerCase().endsWith('.json')?JSON.parse(data):parseSimpleCSV(data);
const samples=normalizeReplay(parsed),p=new MotionPipeline();
if(parsed.reference?.raw&&parsed.reference?.gyro){p.orientation.calibrate(parsed.reference.raw,parsed.reference.gyro);p.reference=parsed.reference}
else p.beginCalibration(samples[0].t);
let last=null,used=0,calibrated=0;
for(const s of samples){const o=p.consume(s,{zupt:true});if(o.phase==='operating'){last=o;used++}if(o.phase==='calibrated')calibrated++}
if(!last){console.error('No operating frames; initial rest calibration may have failed.');process.exit(1)}
const tracks={};for(const src of SOURCES)tracks[src]={free:last.tracks[src].free.snapshot(),constrained:last.tracks[src].constrained.snapshot()};
console.log(JSON.stringify({samples:samples.length,processed:used,calibrated,reference:p.reference,tracks,terminalGravity:last.gravityBody,terminalTiltErrorDeg:last.tiltInnovationDeg},null,2));
