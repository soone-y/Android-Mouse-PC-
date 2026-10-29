// All vectors are XYZ. Units: m/s², rad/s, seconds, metres.
export const G = 9.80665;
export const V = {
  valid: a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite),
  add: (a,b) => a.map((x,i)=>x+b[i]),
  sub: (a,b) => a.map((x,i)=>x-b[i]),
  mul: (a,s) => a.map(x=>x*s),
  dot: (a,b) => a.reduce((s,x,i)=>s+x*b[i],0),
  cross: (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm: a => Math.hypot(...a),
  unit: a => {const n=Math.hypot(...a);return n>1e-9?a.map(v=>v/n):null},
  mean: xs => xs.length ? [0,1,2].map(i=>xs.reduce((n,x)=>n+x[i],0)/xs.length) : null,
  rmsDeviation: (xs,m=null) => {if(!xs.length)return Infinity;const avg=m||V.mean(xs);return Math.sqrt(xs.reduce((n,x)=>n+V.norm(V.sub(x,avg))**2,0)/xs.length)},
};
export const Q = {
  id: ()=>[1,0,0,0],
  norm(q){const n=Math.hypot(...q);return n>1e-12?q.map(x=>x/n):this.id()},
  conj: q=>[q[0],-q[1],-q[2],-q[3]],
  mul: (a,b)=>[
    a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
    a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
    a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
    a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]],
  rotate(q,v){const t=this.mul(this.mul(q,[0,...v]),this.conj(q));return t.slice(1)},
  fromAxisAngle(axis, angle){const n=V.unit(axis);if(!n)return this.id();const s=Math.sin(angle/2);return [Math.cos(angle/2),...n.map(v=>v*s)]},
  fromTo(a,b){
    const u=V.unit(a),v=V.unit(b);if(!u||!v)return null;
    const d=Math.max(-1,Math.min(1,V.dot(u,v)));
    if(d>1-1e-10)return this.id();
    if(d< -1+1e-10){const basis=Math.abs(u[0])<.8?[1,0,0]:[0,1,0];return this.fromAxisAngle(V.cross(u,basis),Math.PI)}
    return this.norm([1+d,...V.cross(u,v)]);
  },
  integrate(q,omega,dt){ // q: device->level frame; gyro measured in device coordinates
    const theta=V.norm(omega)*dt;
    if(theta<1e-10)return this.norm(q);
    return this.norm(this.mul(q,this.fromAxisAngle(omega,theta)));
  },
  tiltError(q,gravityBody){ // correction omega in DEVICE frame, yaw unobservable
    const predicted=this.rotate(this.conj(q),[0,0,1]);
    const measured=V.unit(gravityBody);
    if(!measured)return {angle:Infinity,axis:[0,0,0]};
    const c=V.cross(predicted,measured);
    const angle=Math.atan2(V.norm(c),Math.max(-1,Math.min(1,V.dot(predicted,measured))));
    const axis=V.unit(c)||[0,0,0];
    return {angle,axis};
  }
};
