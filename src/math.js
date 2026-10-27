export const G=9.80665;
export const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,k)=>a.map(v=>v*k),norm:a=>Math.hypot(...a),mean:values=>values.length?[0,1,2].map(i=>values.reduce((s,v)=>s+v[i],0)/values.length):[0,0,0],valid:a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)};
export const Q={
 conj:q=>[q[0],-q[1],-q[2],-q[3]],
 mul:(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]],
 norm:q=>{const n=Math.hypot(...q);return n>1e-10?q.map(x=>x/n):[1,0,0,0]},
 rotate(q,v){return this.mul(this.mul(q,[0,...v]),this.conj(q)).slice(1)},
 fromGravity(g){const n=V.norm(g);if(n<1e-7)return null;const [x,y,z]=g.map(a=>a/n),w=1+z;return w<1e-7?[0,1,0,0]:this.norm([w,y,-x,0])},
 relative(q0,q,v){return this.rotate(this.norm(this.mul(this.conj(q0),q)),v)},
 // gyro body-frame angular rate rad/s; q maps body -> inertial
 integrate(q,w,dt){const h=this.mul(q,[0,...w]).map(x=>x*dt*0.5);return this.norm(q.map((v,i)=>v+h[i]))}
};
export function varianceNorm3(samples,mean=V.mean(samples)){return samples.length?samples.reduce((s,v)=>s+V.norm(V.sub(v,mean))**2,0)/samples.length:Infinity}
