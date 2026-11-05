import assert from 'node:assert/strict';
import {placeRings} from '../public/geometry.js';
const P=5;
// A cutout with a deep notch above its centre and a shoulder near the bottom.
const points=[];
for(let x=75;x<=175;x++)for(let y=70;y<=260;y++){
  const top=Math.abs(x-125)<7?130:70;
  const bottom=x>135?260:210;
  if(y>=top&&y<=bottom)points.push([x,y]);
}
const oldTop=130-6-(27.5-5);
assert.ok(points.some(([x,y])=>Math.hypot(x-125,y-oldTop)<18), 'fixture must reproduce the previous overlap');
let cases=0;
for(const diameter of [7,8,9,10,11,12])for(const margin of [.5,1.2,3])for(const anchorX of [100,125,150]){
  const outer=(diameter+4)/2*P,cut=(diameter+.2)/2*P;
  const {top,bottom}=placeRings(points,anchorX,margin*P,outer,cut,P);
  for(const y of [top,bottom]){
    const closest=Math.min(...points.map(([px,py])=>Math.hypot(px-anchorX,py-y)));
    assert.ok(closest>cut+.5*P,`photo clearance: ${diameter}/${margin}/${anchorX}`);
    assert.ok(closest<outer+margin*P,`ring must contact the photo margin without a stem`);
  }
  cases++;
}
console.log(`PASS ${cases} notched-cutout placements: holes clear photo; rings directly contact margin`);
const {fillEnclosedVoids,outlines}=await import('../public/geometry.js');
function fixture(open=false){const w=17,h=17,d=new Uint8ClampedArray(w*h*4);for(let y=3;y<=13;y++)for(let x=3;x<=13;x++){if(x===3||x===13||y===3||y===13){if(open&&x===3&&y===8)continue;d[(y*w+x)*4+3]=255}}return {d,w,h}}
{
 const {d,w,h}=fixture();const filled=fillEnclosedVoids(d,w,h);
 assert.equal(outlines(d,w,h).length,2,'fixture contains an unwanted interior contour');
 assert.equal(outlines(filled,w,h).length,1,'only the exterior contour must remain');
 assert.equal(filled[(8*w+8)*4+3],255,'enclosed transparency must not produce an inner cutline');
 assert.equal(filled[(1*w+1)*4+3],0,'external transparency must be preserved');
 assert.equal(d[(8*w+8)*4+3],0,'the original photo mask must not be mutated');
}
{
 const {d,w,h}=fixture(true);const filled=fillEnclosedVoids(d,w,h);
 assert.equal(filled[(8*w+8)*4+3],0,'an open exterior notch remains part of the outside silhouette');
}
console.log('PASS enclosed gaps filled; open exterior notches preserved; original photo unchanged');
