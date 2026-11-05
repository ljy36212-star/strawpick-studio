import assert from 'node:assert/strict';
import {closeBodyMask,roundBodyMask,bodyRingJoint,makeFoldLines,foldClearance,placeRings,outlines,fillEnclosedVoids,smoothOutlines} from '../public/geometry.js';
const w=220,h=220,radius=20;
function notch(width,depth){const d=new Uint8ClampedArray(w*h*4);for(let y=30;y<190;y++)for(let x=30;x<190;x++)if(!(Math.abs(x-110)<width/2&&y<30+depth))d[(y*w+x)*4+3]=255;return d}
for(const [width,depth] of [[20,100],[60,100]]){
 const before=notch(width,depth),filled=closeBodyMask(before,w,h,radius),rounded=roundBodyMask(filled,w,h,radius);
 assert.equal(before[(90*w+110)*4+3],0);
 assert.equal(rounded[(90*w+110)*4+3],255,'deep and narrow incisions filled outward');
 for(let i=3;i<before.length;i+=4)if(before[i])assert.equal(filled[i],255,'outward fill never deletes the body');
 assert.equal(rounded[(5*w+110)*4+3],0,'no extra distant contour');
}
const shallow=closeBodyMask(notch(110,20),w,h,radius);
assert.equal(shallow[(35*w+110)*4+3],0,'broad shallow silhouette is preserved');
assert.equal(closeBodyMask(new Uint8ClampedArray(w*h*4),w,h,radius).some(v=>v),false);
const h0={x:100,y:55,r:36},r=55,P=10;
// Straight seam at y=104; a fixed 20px stroke must stay exactly there.
const body=[[[30,104],[170,104],[170,200],[30,200]]],joint=bodyRingJoint(body,h0,r,0);
assert(joint);assert(joint.every(p=>Math.abs(p[1]-104)<1e-9));
const outer=[[[20,0],[180,0],[180,210],[20,210]]];
const lines=makeFoldLines(outer,body,[h0],r,P);assert.equal(lines.length,1);
assert.equal(lines[0].y1,104);assert.equal(lines[0].y2,104);assert.equal(lines[0].x2-lines[0].x1,20);
assert(foldClearance(lines[0],outer,[h0])>=11.5);
// There is ample safe room deeper into the body, but the real seam is too
// close to the hole. It must be omitted, never shifted or shortened.
assert.equal(makeFoldLines(outer,[[[30,98],[170,98],[170,200],[30,200]]],[h0],r,P).length,0);
const tilt=[[[30,94],[170,114],[170,200],[30,200]]],slanted=makeFoldLines(outer,tilt,[h0],r,P);
assert.equal(slanted.length,1);assert(Math.abs(Math.hypot(slanted[0].x2-slanted[0].x1,slanted[0].y2-slanted[0].y1)-20)<1e-9);
for(const [x,y] of [[slanted[0].x1,slanted[0].y1],[slanted[0].x2,slanted[0].y2]])assert(Math.abs(y-(94+(x-30)/7))<1e-8,'fold follows seam angle');
// The documented minimum is 1mm, not 1.15mm. Check both sides of the limit.
for(const [clearance,expected] of [[9.9,0],[10,1],[10.5,1],[11.5,1]]){
 const y=h0.y+h0.r+clearance;
 const folds=makeFoldLines(outer,[[[30,y],[170,y],[170,200],[30,200]]],[h0],r,P);
 assert.equal(folds.length,expected,`seam with ${clearance/P}mm clearance`);
}

// A rotated, rasterized silhouette can meet a ring in several arcs, including
// tiny stair-step contacts. A rejected contact must not hide a safe real seam.
const W=500,H=700,mask=new Uint8ClampedArray(W*H*4),points=[],rotation=.5;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const X=x-250,Y=y-350;
 if((X*Math.cos(rotation)+Y*Math.sin(rotation))**2/90**2+(Y*Math.cos(rotation)-X*Math.sin(rotation))**2/200**2<1){
  mask[(y*W+x)*4+3]=255;points.push([x,y]);
 }
}
const placement=placeRings(points,250,0,r,h0.r,P);
const holes=[{x:250,y:placement.top,r:h0.r},{x:250,y:placement.bottom,r:h0.r}];
const bodyLoops=outlines(mask,W,H),union=new Uint8ClampedArray(mask);
for(const hole of holes)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 if(Math.hypot(x+.5-hole.x,y+.5-hole.y)<=r)union[(y*W+x)*4+3]=255;
}
const loops=smoothOutlines(outlines(fillEnclosedVoids(union,W,H),W,H),1.2);
const safeFolds=makeFoldLines(loops,bodyLoops,holes,r,P);
assert.equal(safeFolds.length,2,'both safe seams survive tiny raster intersections');
for(const fold of safeFolds){
 assert(Math.abs(Math.hypot(fold.x2-fold.x1,fold.y2-fold.y1)-20)<1e-9);
 assert(foldClearance(fold,loops,holes)>=P,'at least 1mm to every cutline');
 const [a,b]=fold.joint;
 assert(Math.abs(fold.x1+fold.x2-a[0]-b[0])<1e-9,'fold stays centered on actual seam');
 assert(Math.abs(fold.y1+fold.y2-a[1]-b[1])<1e-9,'fold is never shifted inward');
}
console.log('PASS outward narrow/deep notch fill, shallow silhouette preservation, exact 2mm straight/tilted seams and unsafe-joint omission');
console.log('PASS 1mm clearance boundary and safe folds on rasterized curved joints');
