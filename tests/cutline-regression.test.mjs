import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothContours, outlines, cleanCutoutMask, closeBodyMask, roundBodyMask,
  makeFoldLines, foldNotice} from '../public/geometry.js';
import {assertSimple, sampleContours, edges, nearest, inside, measuredFoldGap} from './helpers/geometry-oracles.mjs';

function mask(w,h,predicate) {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) data[(y*w+x)*4+3]=predicate(x,y);
  return data;
}

for(const [name,polygon] of Object.entries({
  concave:[[10,10],[75,10],[75,100],[85,100],[85,10],[150,10],[150,150],[10,150]],
  narrowBridge:[[10,10],[150,10],[150,65],[82,65],[82,95],[150,95],[150,150],[10,150],[10,95],[78,95],[78,65],[10,65]],
  asymmetric:[[10,30],[70,10],[145,45],[100,80],[150,120],[45,150],[60,100],[10,100]],
})) {
  test(`curve geometry: ${name} stays closed, tangent, simple and within 0.24mm in both directions`,()=>{
    const raw=outlines(mask(170,170,(x,y)=>inside([x+.5,y+.5],[polygon])?255:0),170,170);
    const saved=JSON.stringify(raw),result=smoothContours(raw,1.2);
    assert.equal(JSON.stringify(raw),saved,'smoothing does not mutate input');
    assert.equal(result.contours.length,1);
    const sampled=sampleContours(result.contours);
    assertSimple(sampled);
    const before=edges(raw),after=edges(sampled);
    for(const p of sampled[0]) assert(nearest(p,before)<=2.4,'outward/inward displacement exceeds 0.24mm');
    for(const p of raw[0]) assert(nearest(p,after)<=2.4,'a narrow feature was lost during smoothing');
    for(const c of result.contours) {
      let from=c.start;
      for(let i=0;i<c.segments.length;i++) {
        const s=c.segments[i],next=c.segments[(i+1)%c.segments.length];
        const a=s.type==='Q'?s.control:from,b=next.type==='Q'?next.control:next.end;
        const u=s.end.map((v,k)=>v-a[k]),v=b.map((x,k)=>x-s.end[k]);
        const lengths=Math.hypot(...u)*Math.hypot(...v);
        assert(lengths>1e-12,'non-degenerate tangent at every join');
        assert((u[0]*v[0]+u[1]*v[1])/lengths>1-1e-8,'tangent discontinuity, including closing join');
        from=s.end;
      }
    }
    assert.deepEqual(smoothContours(raw,1.2),result,'deterministic contours');
  });
}

test('outward notch filling retains a connected 1px neck and leaves a broad shallow bay',()=>{
  const w=180,h=220;
  const raw=mask(w,h,(x,y)=>x>=20&&x<160&&y>=20&&y<200 &&
    !(y>=90&&y<130&&(x<90||x>90))?255:0);
  const body=roundBodyMask(closeBodyMask(raw,w,h,20),w,h,20);
  assert.equal(outlines(body,w,h).length,1,'rounding must not split the neck');
  assert.equal(body[(110*w+90)*4+3],255,'neck is preserved or reinforced');
  const shallow=mask(w,h,(x,y)=>x>=20&&x<160&&y>=20&&y<200 &&
    !(x>=40&&x<140&&y<35)?255:0);
  assert.equal(closeBodyMask(shallow,w,h,20)[(25*w+90)*4+3],0,'broad shallow notch remains open');
});

test('cleanup covers detached opaque specks, connected alpha halos and white subject at all strengths',()=>{
  for(const [strength,alpha] of [[1,50],[2,120],[3,200]]) {
    const raw=mask(100,120,(x,y)=>x>=25&&x<70&&y>=20&&y<100?255:
      x>=70&&x<95&&y>=45&&y<75?alpha:
      x>=5&&x<7&&y>=5&&y<7?255:0);
    for(let k=0;k<raw.length;k+=4)raw[k]=raw[k+1]=raw[k+2]=255;
    const saved=new Uint8ClampedArray(raw),result=cleanCutoutMask(raw,100,120,true,strength);
    assert.equal(result.mask[(60*100+85)*4+3],0,'connected halo');
    assert.equal(result.mask[(5*100+5)*4+3],0,'detached speck');
    assert.equal(result.mask[(60*100+50)*4+3],255,'white material is not background');
    assert.equal(result.mask[(60*100+70)*4+3],255,'soft antialias edge');
    assert.equal(outlines(result.mask,100,120).length,1);
    assert.deepEqual(raw,saved,'input is unchanged');
    assert.equal(cleanCutoutMask(raw,100,120,false,strength).mask[(60*100+85)*4+3],255,'explicit override');
  }
});

test('fold guard checks 1mm boundary with curve error, second hole and crossing outer cuts',()=>{
  const hole={x:100,y:55,r:36},outer=[[[0,0],[200,0],[200,220],[0,220]]];
  for(const [gap,expected] of [[9.99,0],[10,0],[10.006,0],[10.008,1],[11,1]]) {
    const y=91+gap,body=[[[20,y],[180,y],[180,200],[20,200]]];
    const folds=makeFoldLines(outer,body,[hole],55,10,.007);
    assert.equal(folds.length,expected,`${gap/10}mm with flattening/serialization reserve`);
    for(const f of folds) assert(measuredFoldGap(f,outer,[hole])>=10.007-1e-9);
  }
  const body=[[[20,105],[180,105],[180,200],[20,200]]];
  assert.equal(makeFoldLines(outer,body,[hole,{x:100,y:115,r:9.5}],55,10,.007).some(f=>f.index===0),false,
    'the other hole also participates in the fold clearance');
  const notch=[[[0,0],[97,0],[97,110],[103,110],[103,0],[200,0],[200,220],[0,220]]];
  assert.equal(makeFoldLines(notch,body,[hole],55,10,.007).length,0,'endpoints alone cannot prove segment safety');
  assert.deepEqual(foldNotice([],2).missing,[0,1]);
  assert.deepEqual(foldNotice([{index:0}],2).missing,[1]);
  assert.deepEqual(foldNotice([{index:0}],1).missing,[]);
});
