import assert from 'node:assert/strict';
import {cleanCutoutMask,outlines} from '../public/geometry.js';
const W=250,H=350,raw=new Uint8ClampedArray(W*H*4);
function dot(x,y,a=255){raw[(y*W+x)*4+3]=a}
function rect(x,y,w,h,a=255){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)dot(i,j,a)}
rect(60,65,120,200); // Main subject, 24,000 pixels.
rect(180,120,1,4); // Attached fine detail.
rect(181,120,1,4,32); // Attached translucent edge.
rect(210,110,10,10); // Meaningful detached secondary detail.
rect(12,20,2,2);rect(220,310,3,3);dot(25,300); // Opaque stray fragments.
rect(10,170,12,16,25); // Large but faint ghost, without an opaque core.
const before=new Uint8ClampedArray(raw);
const clean=cleanCutoutMask(raw,W,H);
assert.equal(clean.mask[(20*W+12)*4+3],0,'isolated opaque specks are removed');
assert.equal(clean.mask[(310*W+220)*4+3],0,'separate small fragments are removed');
assert.equal(clean.mask[(175*W+15)*4+3],0,'faint residual clouds are removed');
assert.equal(clean.mask[(120*W+180)*4+3],255,'attached detail remains');
assert.equal(clean.mask[(120*W+181)*4+3],255,'translucent edge connected to subject remains');
assert.equal(clean.mask[(110*W+210)*4+3],255,'meaningful independent detail remains');
assert.equal(outlines(clean.mask,W,H).length,2,'no detached cutlines for specks');
assert.deepEqual(raw,before,'original pixels are not modified');
const off=cleanCutoutMask(raw,W,H,false);assert.equal(off.mask[(20*W+12)*4+3],255,'cleanup can be disabled');
assert.ok(outlines(off.mask,W,H).length>2);
const tiny=new Uint8ClampedArray(16);tiny[3]=255;assert.equal(cleanCutoutMask(tiny,2,2).points.length,1,'a tiny whole subject is not erased');
assert.equal(cleanCutoutMask(new Uint8ClampedArray(16),2,2).points.length,0,'empty images stay empty');
console.log('PASS opaque specks and faint ghosts removed; subject edges and meaningful details preserved; toggle and tiny images supported');
const ghost=new Uint8ClampedArray(20*20*4);
for(let y=1;y<4;y++)for(let x=1;x<4;x++)ghost[(y*20+x)*4+3]=255;
for(let y=10;y<18;y++)for(let x=10;x<18;x++)ghost[(y*20+x)*4+3]=25;
ghost[(10*20+10)*4+3]=255;
const chosen=cleanCutoutMask(ghost,20,20);
assert.equal(chosen.mask[(10*20+10)*4+3],0,'a broad faint ghost with one solid speck must not become the main subject');
assert.equal(chosen.points.length,9);
// A faint cloud can be connected to a real subject. It must not expand the
// white material mask far outside the opaque subject.
const cloud=new Uint8ClampedArray(50*50*4);
for(let y=10;y<40;y++)for(let x=10;x<30;x++){const k=(y*50+x)*4;cloud[k]=cloud[k+1]=cloud[k+2]=cloud[k+3]=255}
for(let y=15;y<35;y++)for(let x=30;x<45;x++)cloud[(y*50+x)*4+3]=25;
const clearCloud=cleanCutoutMask(cloud,50,50);
assert.equal(clearCloud.mask[(20*50+40)*4+3],0,'connected weak-alpha fog must not become white backing');
assert.equal(clearCloud.mask[(20*50+30)*4+3],255,'soft edge beside the subject remains');
assert.equal(clearCloud.mask[(20*50+20)*4+3],255,'genuine opaque white subject pixels remain');
assert.equal(cleanCutoutMask(cloud,50,50,false).mask[(20*50+40)*4+3],255,'manual override preserves original soft pixels');
console.log('PASS connected alpha fog removed; antialiased edge and genuine white subject preserved');
function connectedHalo(alpha){const rgba=new Uint8ClampedArray(60*50*4);for(let y=8;y<42;y++)for(let x=8;x<32;x++)rgba[(y*60+x)*4+3]=255;for(let y=16;y<34;y++)for(let x=32;x<55;x++)rgba[(y*60+x)*4+3]=alpha;return rgba}
const mediumHalo=connectedHalo(120);
assert.equal(cleanCutoutMask(mediumHalo,60,50,true,2).mask[(25*60+45)*4+3],0,'default cleanup rejects broad, connected alpha-120 halos');
assert.equal(cleanCutoutMask(mediumHalo,60,50,true,1).mask[(25*60+45)*4+3],255,'gentle mode preserves semi-transparent artwork on request');
const heavyHalo=connectedHalo(200);
assert.equal(cleanCutoutMask(heavyHalo,60,50,true,3).mask[(25*60+45)*4+3],0,'strong cleanup rejects connected alpha-200 halos');
assert.equal(cleanCutoutMask(heavyHalo,60,50,true,3).mask[(25*60+20)*4+3],255,'strong cleanup preserves the opaque subject');
assert.equal(cleanCutoutMask(heavyHalo,60,50,false,3).mask[(25*60+45)*4+3],255,'off bypasses all strength thresholds');
console.log('PASS medium and high-opacity connected halos; 3 strengths and override');
