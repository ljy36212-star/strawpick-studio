// All coordinates are in mask pixels. The ring overlaps the photo's margin,
// while the cutting circle stays clear of every visible photo pixel.
export function placeRings(points, anchorX, margin, ringRadius, cutRadius, pxPerMm) {
  const pixelGuard = Math.SQRT1_2;
  // Leave room for the fixed fold at the actual body/ring junction.
  const contactRadius = Math.max(ringRadius - pxPerMm, cutRadius + 1.2 * pxPerMm) + margin + pixelGuard;
  const clearRadius = cutRadius + 0.5 * pxPerMm + pixelGuard;
  let top = Infinity, bottom = -Infinity;
  for (const [x, y] of points) {
    const dx = Math.abs(x - anchorX);
    for (const radius of [contactRadius, clearRadius]) {
      if (dx > radius) continue;
      const dy = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      top = Math.min(top, y - dy);
      bottom = Math.max(bottom, y + dy);
    }
  }
  return {top, bottom};
}

// Fill enclosed transparency before tracing. Intentional straw holes are added
// separately after this step, so they remain independent cutting circles.
export function fillEnclosedVoids(rgba,width,height) {
  const result=new Uint8ClampedArray(rgba);
  const outside=new Uint8Array(width*height);
  const queue=new Int32Array(width*height);
  let read=0,write=0;
  function visit(x,y){
    const k=y*width+x;
    if(outside[k]||rgba[k*4+3]>127)return;
    outside[k]=1;queue[write++]=k;
  }
  for(let x=0;x<width;x++){visit(x,0);visit(x,height-1)}
  for(let y=1;y<height-1;y++){visit(0,y);visit(width-1,y)}
  while(read<write){
    const k=queue[read++],x=k%width,y=Math.floor(k/width);
    if(x>0)visit(x-1,y);if(x<width-1)visit(x+1,y);
    if(y>0)visit(x,y-1);if(y<height-1)visit(x,y+1);
  }
  for(let k=0;k<outside.length;k++)if(!outside[k]&&rgba[k*4+3]<=127){
    const i=k*4;result[i]=result[i+1]=result[i+2]=result[i+3]=255;
  }
  return result;
}

export function outlines(data,W,H){const edges=new Map;function edge(a,b){if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b)}const on=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&data[(y*W+x)*4+3]>127;const key=(x,y)=>y*(W+1)+x;
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(on(x,y)){if(!on(x,y-1))edge(key(x,y),key(x+1,y));if(!on(x+1,y))edge(key(x+1,y),key(x+1,y+1));if(!on(x,y+1))edge(key(x+1,y+1),key(x,y+1));if(!on(x-1,y))edge(key(x,y+1),key(x,y))}
const loops=[];while(edges.size){let start=edges.keys().next().value,k=start,pts=[],guard=0;do{pts.push([k%(W+1),Math.floor(k/(W+1))]);const arr=edges.get(k);if(!arr?.length)break;const next=arr.pop();if(!arr.length)edges.delete(k);k=next;if(++guard>W*H*8)break}while(k!==start);if(pts.length>3){pts=pts.filter((p,i,a)=>{let b=a[(i+a.length-1)%a.length],d=a[(i+1)%a.length];return(p[0]-b[0])*(d[1]-p[1])!==(p[1]-b[1])*(d[0]-p[0])});if(pts.length>2)loops.push(pts)}}return loops}

// Remove detached specks before margin expansion can turn them into sizeable
// islands. Keep meaningful secondary components and every attached detail.
export function cleanCutoutMask(rgba,width,height,enabled=true,strength=2){
  const count=width*height,labels=new Int32Array(count),queue=new Int32Array(count);
  const parts=[];const low=enabled?16:8;const coreAlpha=({1:64,2:160,3:224})[strength]||160;let label=0;
  const candidate=new Uint8Array(count);
  for(let k=0;k<count;k++)candidate[k]=rgba[k*4+3]>low?1:0;
  if(enabled){
    // A faint cloud connected to the subject is still residue. Retain soft
    // alpha only within two mask pixels of an opaque core, preserving edges.
    const distance=new Uint8Array(count);distance.fill(255);let head=0,tail=0;
    for(let k=0;k<count;k++)if(rgba[k*4+3]>=coreAlpha){distance[k]=0;queue[tail++]=k}
    const hasCore=tail>0;
    while(head<tail){const k=queue[head++];if(distance[k]>=2)continue;
      const x=k%width,y=Math.floor(k/width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
        const j=ny*width+nx;if(!candidate[j]||distance[j]!==255)continue;
        distance[j]=distance[k]+1;queue[tail++]=j;
      }
    }
    if(hasCore)for(let k=0;k<count;k++)if(distance[k]===255)candidate[k]=0;
  }
  for(let start=0;start<count;start++){
    if(labels[start]||!candidate[start])continue;
    label++;let head=0,tail=1,strong=0;queue[0]=start;labels[start]=label;
    while(head<tail){const k=queue[head++],x=k%width,y=Math.floor(k/width);if(rgba[k*4+3]>=coreAlpha)strong++;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if((!dx&&!dy)||nx<0||nx>=width||ny<0||ny>=height)continue;
        const j=ny*width+nx;if(labels[j]||!candidate[j])continue;labels[j]=label;queue[tail++]=j;
      }
    }
    parts.push({id:label,area:tail,strong});
  }
  const reliable=parts.filter(p=>p.strong>0);
  const main=(reliable.length?reliable:parts).reduce((a,b)=>!a||b.strong>a.strong||(b.strong===a.strong&&b.area>a.area)?b:a,null);
  const minimum=main?Math.max(6,Math.ceil(main.area*.0025)):0;
  const keep=new Set(parts.filter(p=>!enabled||p===main||(p.area>=minimum&&p.strong>=2)).map(p=>p.id));
  const points=[];const mask=new Uint8ClampedArray(rgba.length);let removed=0;
  for(let k=0;k<count;k++){
    if(keep.has(labels[k])){points.push([k%width,Math.floor(k/width)]);const i=k*4;mask[i]=mask[i+1]=mask[i+2]=mask[i+3]=255}
    else if(rgba[k*4+3]>8)removed++;
  }
  return {mask,points,removed};
}

// Sample quadratic corner fillets so all renderers and PDF use identical contours.
export function roundCorners(loops,radius){
 if(!(radius>0))return loops.map(l=>l.map(p=>[...p]));
 return loops.map(loop=>loop.flatMap((b,i)=>{
  const a=loop[(i+loop.length-1)%loop.length],c=loop[(i+1)%loop.length];
  const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
  if(!ab||!bc)return [[...b]];
  const d=Math.min(radius,ab/2,bc/2),u=b.map((v,k)=>v+(a[k]-v)*d/ab),v=b.map((x,k)=>x+(c[k]-x)*d/bc);
  const steps=Math.max(2,Math.ceil(d*2));
  return Array.from({length:steps+1},(_,j)=>{const t=j/steps;return b.map((x,k)=>(1-t)**2*u[k]+2*(1-t)*t*x+t*t*v[k])});
 }));
}

const pointSegmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
function insideLoops([x,y],loops){
 let inside=false;
 for(const loop of loops)for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length];
  if((a[1]>y)!==(b[1]>y)&&x<a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))inside=!inside;
 }return inside;
}
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&
  Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.max(c[0],d[0])>=Math.min(a[0],b[0])&&
  Math.max(a[1],b[1])>=Math.min(c[1],d[1])&&Math.max(c[1],d[1])>=Math.min(a[1],b[1]))return 0;
 return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
export function foldClearance(line,loops,holes){
 const a=[line.x1,line.y1],b=[line.x2,line.y2];let d=Infinity;
 if(!insideLoops(a,loops)||!insideLoops(b,loops))return -1;
 for(const loop of loops)for(let i=0;i<loop.length;i++)d=Math.min(d,segmentDistance(a,b,loop[i],loop[(i+1)%loop.length]));
 for(const h of holes)d=Math.min(d,pointSegmentDistance([h.x,h.y],a,b)-h.r);
 return d;
}
// Find the two circle/body intersections bounding the attached arc. Their
// chord is the real seam, including tilted joints on asymmetric silhouettes.
function bodyRingJoints(bodyLoops,h,radius,index){
 const hits=[];
 for(const loop of bodyLoops)for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length],dx=b[0]-a[0],dy=b[1]-a[1],fx=a[0]-h.x,fy=a[1]-h.y;
  const aa=dx*dx+dy*dy,bb=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-radius*radius,disc=bb*bb-4*aa*cc;
  if(!aa||disc<0)continue;
  for(const t of [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>=0&&t<=1){
   const p=[a[0]+t*dx,a[1]+t*dy];
   if(!hits.some(q=>Math.hypot(p[0]-q.p[0],p[1]-q.p[1])<.01))hits.push({p,angle:(Math.atan2(p[1]-h.y,p[0]-h.x)+Math.PI*2)%(Math.PI*2)});
  }
 }
 hits.sort((a,b)=>a.angle-b.angle);const candidates=[],direction=index===0?1:-1;
 for(let i=0;i<hits.length;i++){
  const a=hits[i],b=hits[(i+1)%hits.length],span=(b.angle-a.angle+Math.PI*2)%(Math.PI*2);
  if(span<=0||span>=Math.PI)continue;
  const angle=a.angle+span/2,arc=[h.x+radius*Math.cos(angle),h.y+radius*Math.sin(angle)];
  if(direction*(arc[1]-h.y)<=0||!insideLoops(arc,bodyLoops))continue;
  const mid=[(a.p[0]+b.p[0])/2,(a.p[1]+b.p[1])/2],cost=(mid[0]-h.x)**2+(mid[1]-h.y-direction*radius)**2;
  candidates.push({joint:a.p[0]<=b.p[0]?[a.p,b.p]:[b.p,a.p],cost});
 }return candidates.sort((a,b)=>a.cost-b.cost).map(candidate=>candidate.joint);
}
export function bodyRingJoint(bodyLoops,h,radius,index){
 return bodyRingJoints(bodyLoops,h,radius,index)[0]??null;
}
export function makeFoldLines(loops,bodyLoops,holes,outerRadius,pxPerMm){
 const gap=pxPerMm,length=2*pxPerMm;
 return holes.flatMap((h,index)=>{
  // Raster stair steps can create tiny extra intersection arcs. Reject unsafe
  // candidates without hiding another real seam that has enough room.
  for(const joint of bodyRingJoints(bodyLoops,h,outerRadius,index)){
   const [a,b]=joint,span=Math.hypot(b[0]-a[0],b[1]-a[1]);if(span<length)continue;
   const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=(b[0]-a[0])/span*length/2,dy=(b[1]-a[1])/span*length/2;
   const line={x1:mx-dx,y1:my-dy,x2:mx+dx,y2:my+dy,index,joint};
   // Keep the full 2mm fold centered on its actual seam with at least 1mm
   // clearance to every outer cutline and hole; never shift or shorten it.
   if(foldClearance(line,loops,holes)>=gap)return [line];
  }
  return [];
 });
}

// Exact squared Euclidean distance transform, separable in O(width*height).
function distanceTo(mask,w,h,value){
 const inf=1e12,out=new Float64Array(w*h),tmp=new Float64Array(w*h),n=Math.max(w,h),f=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1),d=new Float64Array(n);
 function edt(len){let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
  for(let q=1;q<len;q++){let s;do{s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*(q-v[k]));if(s<=z[k])k--;else break;}while(k>=0);k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}
  k=0;for(let q=0;q<len;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}
 }
 for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=mask[y*w+x]===value?0:inf;edt(w);for(let x=0;x<w;x++)tmp[y*w+x]=d[x];}
 for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=tmp[y*w+x];edt(h);for(let y=0;y<h;y++)out[y*w+x]=d[y];}return out;
}
export function roundBodyMask(rgba,w,h,radius){
 if(radius<=0)return new Uint8ClampedArray(rgba);
 const mask=new Uint8Array(w*h);for(let k=0;k<mask.length;k++)mask[k]=rgba[k*4+3]>127?1:0;
 const distances=distanceTo(mask,w,h,0),core=new Uint8Array(w*h);let count=0;
 for(let k=0;k<mask.length;k++)if(mask[k]&&distances[k]>radius*radius){core[k]=1;count++;}
 if(!count)return new Uint8ClampedArray(rgba); // Never delete an entire narrow body.
 const expanded=distanceTo(core,w,h,1),out=new Uint8ClampedArray(rgba.length);
 for(let k=0;k<mask.length;k++)if(mask[k]&&expanded[k]<=radius*radius){out[k*4]=out[k*4+1]=out[k*4+2]=out[k*4+3]=255;}return out;
}
// Bridge deep bays to their outer mouth before circular smoothing. A broad,
// shallow change in the silhouette is retained; a deep incision is filled.
export function fillDeepNotches(rgba,w,h,radius){
 const out=new Uint8ClampedArray(rgba),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 for(const loop of outlines(rgba,w,h)){
  const sorted=loop.map(([x,y],index)=>({x,y,index})).sort((a,b)=>a.x-b.x||a.y-b.y),lower=[],upper=[];
  for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}
  for(const p of [...sorted].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
  for(let i=0;i<hull.length;i++){
   const a=hull[i],b=hull[(i+1)%hull.length],pocket=[loop[a.index]];
   for(let j=(a.index+1)%loop.length;j!==b.index;j=(j+1)%loop.length)pocket.push(loop[j]);
   pocket.push(loop[b.index]);if(pocket.length<3)continue;
   const mouth=Math.hypot(b.x-a.x,b.y-a.y);let depth=0,low=h,high=0;
   for(const p of pocket){depth=Math.max(depth,pointSegmentDistance(p,[a.x,a.y],[b.x,b.y]));low=Math.min(low,p[1]);high=Math.max(high,p[1]);}
   if(depth<=Math.max(2*radius,.5*mouth))continue;
   const minY=Math.max(0,Math.floor(low)),maxY=Math.min(h-1,Math.ceil(high));
   for(let y=minY;y<=maxY;y++){
    const hits=[],scan=y+.5;
    for(let j=0;j<pocket.length;j++){const p=pocket[j],q=pocket[(j+1)%pocket.length];if((p[1]>scan)!==(q[1]>scan))hits.push(p[0]+(scan-p[1])*(q[0]-p[0])/(q[1]-p[1]));}
    hits.sort((a,b)=>a-b);
    for(let j=0;j+1<hits.length;j+=2)for(let x=Math.max(0,Math.ceil(hits[j]-.5));x<Math.min(w,Math.ceil(hits[j+1]-.5));x++){const k=(y*w+x)*4;out[k]=out[k+1]=out[k+2]=out[k+3]=255;}
   }
  }
 }return out;
}
// Circular closing fills narrow inward slots outwards. Padding prevents
// the page border from being mistaken for solid material during erosion.
export function closeBodyMask(rgba,w,h,radius){
 if(radius<=0)return new Uint8ClampedArray(rgba);
 rgba=fillDeepNotches(rgba,w,h,radius);
 const pad=Math.ceil(radius)+2,pw=w+pad*2,ph=h+pad*2,mask=new Uint8Array(pw*ph);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)mask[(y+pad)*pw+x+pad]=rgba[(y*w+x)*4+3]>127?1:0;
 const distance=distanceTo(mask,pw,ph,1),expanded=new Uint8Array(mask.length),r2=radius*radius;
 for(let k=0;k<mask.length;k++)expanded[k]=distance[k]<=r2?1:0;
 const inward=distanceTo(expanded,pw,ph,0),out=new Uint8ClampedArray(rgba.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y+pad)*pw+x+pad,i=(y*w+x)*4;
  if(mask[k]||inward[k]>r2)out[i]=out[i+1]=out[i+2]=out[i+3]=255;
 }return out;
}
function simplifyOpen(points,tolerance){
 if(points.length<3)return points;let max=0,index=0;
 for(let i=1;i<points.length-1;i++){const d=pointSegmentDistance(points[i],points[0],points.at(-1));if(d>max){max=d;index=i}}
 if(max<=tolerance)return [points[0],points.at(-1)];
 return [...simplifyOpen(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyOpen(points.slice(index),tolerance)];
}
export function smoothOutlines(loops,tolerance){
 return loops.map(loop=>{
  const mid=Math.floor(loop.length/2);let pts=[...simplifyOpen(loop.slice(0,mid+1),tolerance).slice(0,-1),...simplifyOpen([...loop.slice(mid),loop[0]],tolerance).slice(0,-1)];
  // Bound smoothing to submillimetre corners, even along very long straight edges.
  return roundCorners([pts],tolerance*4)[0];
 });
}
export function pointBounds(points){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [x,y] of points){minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY)}return {minX,maxX,minY,maxY,cx:(minX+maxX+1)/2,cy:(minY+maxY+1)/2}}
export function foldNotice(folds,count){
 const missing=Array.from({length:count},(_,i)=>i).filter(i=>!folds.some(f=>f.index===i));
 if(missing.length)return {missing,text:missing.map(i=>i===0?'위쪽':'아래쪽').join('·')+' 이음부는 접힘선이 없어 접히지 않습니다. 이음부에 2mm 접힘선과 칼선 간 최소 1mm 간격을 확보할 수 있도록 사진 크기나 사진 여백을 조절해주세요.'};
 return {missing,text:'접힘선 각 2.0mm · 이음부 고정 · 칼선과 최소 1mm 간격'};
}
