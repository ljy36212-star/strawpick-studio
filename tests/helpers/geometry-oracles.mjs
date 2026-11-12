import assert from 'node:assert/strict';

export const distance = (p, a, b) => {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy);
};
export function inside(p, loops) {
  let result = false;
  for (const l of loops) for (let i=0, j=l.length-1; i<l.length; j=i++) {
    const a=l[i], b=l[j];
    if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
export const edges = loops => loops.flatMap(l => l.map((p,i) => [p,l[(i+1)%l.length]]));
export function nearest(p, segments) {
  let d=Infinity;
  for (const [a,b] of segments) d=Math.min(d,distance(p,a,b));
  return d;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const intersects=(a,b,c,d)=>
  Math.max(a[0],b[0])+1e-9>=Math.min(c[0],d[0]) && Math.max(c[0],d[0])+1e-9>=Math.min(a[0],b[0]) &&
  Math.max(a[1],b[1])+1e-9>=Math.min(c[1],d[1]) && Math.max(c[1],d[1])+1e-9>=Math.min(a[1],b[1]) &&
  cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0;

export function assertSimple(loops) {
  for (const loop of loops) {
    assert(loop.length>=3);
    assert(loop.flat().every(Number.isFinite), 'all coordinates must be finite');
    const e=edges([loop]);
    for (let i=0;i<e.length;i++) {
      assert(Math.hypot(e[i][0][0]-e[i][1][0],e[i][0][1]-e[i][1][1])>1e-9, 'no zero-length edges');
      for (let j=i+2;j<e.length;j++) {
        if (i===0 && j===e.length-1) continue;
        assert(!intersects(...e[i],...e[j]), `self-intersection at edges ${i}/${j}`);
      }
    }
  }
  for(let i=0;i<loops.length;i++) for(let j=i+1;j<loops.length;j++)
    for(const a of edges([loops[i]])) for(const b of edges([loops[j]]))
      assert(!intersects(...a,...b), 'different exterior components intersect');
}

// Independent sampling of the emitted quadratics; does not call flattenContours.
export function sampleContours(contours, steps=32) {
  return contours.map(c=>{
    let from=c.start; const points=[[...from]];
    for(const s of c.segments) {
      if(s.type==='Q') for(let i=1;i<=steps;i++) {
        const t=i/steps; points.push(from.map((v,k)=>(1-t)**2*v+2*(1-t)*t*s.control[k]+t*t*s.end[k]));
      } else points.push([...s.end]);
      from=s.end;
    }
    assert(Math.hypot(from[0]-c.start[0],from[1]-c.start[1])<1e-8,'closed contour');
    points.pop(); return points;
  });
}

export function photoBoundary(canvas) {
  const {width:w,height:h}=canvas, a=canvas.getContext('2d').getImageData(0,0,w,h).data;
  const opaque=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&a[(y*w+x)*4+3]>127;
  const points=[];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(opaque(x,y) &&
    (!opaque(x-1,y)||!opaque(x+1,y)||!opaque(x,y-1)||!opaque(x,y+1)))
    points.push([x,y],[x+1,y],[x,y+1],[x+1,y+1]);
  return points;
}

export function measuredFoldGap(fold, loops, holes) {
  const a=[fold.x1,fold.y1],b=[fold.x2,fold.y2];
  if(!inside(a,loops)||!inside(b,loops)) return -1;
  let gap=Infinity;
  for(const [c,d] of edges(loops)) gap=Math.min(gap, intersects(a,b,c,d)?0:
    Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b)));
  for(const h of holes) gap=Math.min(gap,distance([h.x,h.y],a,b)-h.r);
  return gap;
}

// Parse the ACTUAL serialized exports. Never compare a serializer to itself.
export function parseSvgPath(d) {
  const tokens=d.match(/[MLQZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
  let i=0; const result=[];
  while(i<tokens.length) {
    const op=tokens[i++],count={M:2,L:2,Q:4,Z:0}[op];
    assert.notEqual(count,undefined,`unsupported SVG operator ${op}`);
    const args=tokens.slice(i,i+count).map(Number);i+=count;
    assert.equal(args.length,count); assert(args.every(Number.isFinite));result.push({op,args});
  }
  return result;
}
export function parsePdfPath(text) {
  const result=[],stack=[];
  for(const token of text.trim().split(/\s+/)) {
    if(/^[+-]?(?:\d*\.)?\d+$/.test(token)) {stack.push(Number(token));continue;}
    const count={m:2,l:2,c:6,h:0}[token];
    assert.notEqual(count,undefined,`unexpected PDF path token ${token}`);
    assert.equal(stack.length,count,`PDF operand count for ${token}`);
    result.push({op:token,args:stack.splice(0)});
  }
  assert.equal(stack.length,0);return result;
}
export function assertSvgPdfExterior(svgCommands,pdfCommands) {
  const scale=72/254, height=70*72/25.4;
  assert.equal(pdfCommands.length,svgCommands.length);
  let from;
  for(let i=0;i<svgCommands.length;i++) {
    const {op,args}=svgCommands[i],pdf=pdfCommands[i];
    assert.equal(pdf.op,{M:'m',L:'l',Q:'c',Z:'h'}[op]);
    if(op==='Z') continue;
    const end=args.slice(-2),endPt=[end[0]*scale,height-end[1]*scale];
    for(let k=0;k<2;k++) assert(Math.abs(pdf.args.at(k-2)-endPt[k])<0.0001,'SVG/PDF endpoint precision');
    if(op==='Q') for(const t of [0,.1,.25,.5,.75,.9,1]) for(let k=0;k<2;k++) {
      const q=(1-t)**2*from[k]+2*(1-t)*t*args[k]+t*t*end[k];
      const expected=k===0?q*scale:height-q*scale;
      const p0=k===0?from[k]*scale:height-from[k]*scale;
      const actual=(1-t)**3*p0+3*(1-t)**2*t*pdf.args[k]+3*(1-t)*t*t*pdf.args[k+2]+t**3*pdf.args[k+4];
      assert(Math.abs(expected-actual)<0.00012,'SVG/PDF Bezier differs by more than serialization precision');
    }
    from=end;
  }
}
