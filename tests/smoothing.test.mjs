import assert from 'node:assert/strict';
import {outlines,smoothContours,contourPath,contourPdfPath} from '../public/geometry.js';

const w=220,h=260,data=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(((x-110)/73)**2+((y-130)/101)**2<=1)data[(y*w+x)*4+3]=255;
const raw=outlines(data,w,h),{contours,loops}=smoothContours(raw,1.2);
assert.equal(contours.length,1,'one connected exterior, no extra cutline islands');
assert(contours[0].segments.length<raw[0].length/3,'pixel stair steps become a compact vector outline');
assert(contourPath(contours).includes('Q'),'SVG keeps actual curves');

const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
for(const p of loops[0])assert(Math.min(...raw[0].map((a,i)=>distance(p,a,raw[0][(i+1)%raw[0].length])))<2.4,'smoothing stays within 0.24mm of the traced photo margin');

const c=contours[0],segments=c.segments;
let from=c.start;
for(let i=0;i<segments.length;i++){
 const s=segments[i],next=segments[(i+1)%segments.length];
 const a=s.type==='Q'?s.control:from,b=next.type==='Q'?next.control:next.end;
 const incoming=s.end.map((v,k)=>v-a[k]),outgoing=b.map((v,k)=>v-s.end[k]);
 const cosine=(incoming[0]*outgoing[0]+incoming[1]*outgoing[1])/(Math.hypot(...incoming)*Math.hypot(...outgoing));
 assert(cosine>1-1e-8,'adjacent curves and lines meet tangentially without visible corners');
 from=s.end;
}
assert(Math.hypot(...from.map((v,k)=>v-c.start[k]))<1e-8,'the closing join is continuous');

// Compare points on the PDF's emitted cubic curves to the preview/SVG quadratics.
const scale=72/254,height=70*72/25.4,pdf=contourPdfPath(contours,scale,height).split('\n');
let command=1;from=c.start;
for(const s of segments){
 const row=pdf[command++].split(' '),op=row.pop(),n=row.map(Number);
 if(s.type==='Q'){
  assert.equal(op,'c','PDF preserves Bezier geometry instead of polygonal chords');
  const p0=[from[0]*scale,height-from[1]*scale],p1=n.slice(0,2),p2=n.slice(2,4),p3=n.slice(4,6);
  for(const t of [.1,.25,.5,.75,.9])for(let k=0;k<2;k++){
   const q=(1-t)**2*from[k]+2*(1-t)*t*s.control[k]+t*t*s.end[k];
   const expected=k===0?q*scale:height-q*scale;
   const actual=(1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k];
   assert(Math.abs(actual-expected)<.0001,'PDF and preview curves agree within serialization precision');
  }
 }else assert.equal(op,'l');
 from=s.end;
}
assert.equal(pdf.at(-1),'h');
console.log('PASS smooth tangent joins, bounded silhouette change, connected exterior, identical SVG/PDF curves');
