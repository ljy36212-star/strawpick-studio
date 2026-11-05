import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as geometry from '../public/geometry.js';
const require=createRequire(import.meta.url);
const {createCanvas,Path2D,Image}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');
const els=new Map();function el(id){if(!els.has(id)){const e=['canvas','preview'].includes(id)?createCanvas(500,700):{};Object.assign(e,{value:0,style:{},dataset:{},classList:{toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},getAttribute(){return null},scrollIntoView(){},checked:true,open:false,showModal(){this.open=true;this.opens=(this.opens||0)+1},close(){this.open=false}});els.set(id,e)}return els.get(id)}
const document={getElementById:el,createElement:tag=>tag==='canvas'?createCanvas(1,1):el(tag),querySelector:el,querySelectorAll:()=>[],body:{dataset:{}}};
const sandbox=vm.createContext({...geometry,document,Path2D,Image,console,TextEncoder,Blob,atob,setTimeout:()=>1,clearTimeout(){},URL});
vm.runInContext(fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*\n/,''),sandbox);
function run(s){return vm.runInContext(s,sandbox)}
run(`img=document.createElement('canvas');img.width=300;img.height=400;{const q=img.getContext('2d');q.fillStyle='#789c7c';q.fillRect(15,35,170,280)}current=original='test';centerComposition();flowStep=3;draw();`);
assert(Math.abs(run('geo.bodyBounds.cx/P')-25)<.1,'visible photo centered, ignoring transparent padding');
assert(Math.abs(run('geo.holeX')-25)<.1,'rings centered');
const area=loops=>Math.abs(loops.reduce((sum,l)=>sum+l.reduce((a,p,i)=>{const q=l[(i+1)%l.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2,0));
const before=area(run('geo.loops'));run('s.roundness=3;draw()');const after=area(run('geo.loops'));
assert(after<before-20,'roundness must remove visible area instead of being overwritten');
assert.equal(run('geo.loops.length'),1,'body and rings connected');
for(const diameter of [7,8,9,10,11,12])for(const count of [1,2]){
 run(`s.holeDiameter=${diameter};s.holeCount=${count};draw()`);
 const folds=run('geo.folds'),loops=run('geo.loops'),holes=run('holePositions().map(y=>({x:geo.holeX*P,y:y*P,r:cutDiameter()/2*P}))');
 assert.equal(folds.length,count,`folds for diameter ${diameter}, count ${count}`);for(const line of folds){
  assert(geometry.foldClearance(line,loops,holes)>=11.49);
  assert(Math.abs(Math.hypot(line.x2-line.x1,line.y2-line.y1)-20)<1e-8,'exactly 2mm');
  const [a,b]=line.joint;
  assert(Math.abs((line.x1+line.x2)-(a[0]+b[0]))<1e-8,'fold centered on junction');
  assert(Math.abs((line.y1+line.y2)-(a[1]+b[1]))<1e-8,'fold pinned to junction, not offset');
 }
}
run('s.holeCount=2;s.holeDiameter=7;s.autoCenter=false;s.holeX=8;s.x+=4;draw()');assert(Math.abs(run('geo.holeX-geo.bodyBounds.cx/P'))<.1,'automatic alignment overrides legacy manual position and follows moved body');
run('centerComposition();draw()');
const data=el('canvas').getContext('2d').getImageData(0,0,1000,1400).data;let blue=0;for(let i=0;i<data.length;i+=4)if(data[i+2]>data[i]+40&&data[i+2]>data[i+1]+20&&data[i+3]>50)blue++;
assert(blue>20,'folds visibly rendered in preview');
const missing=geometry.foldNotice([{index:0,x1:0,x2:20}],2,2,10);assert(missing.text.includes('아래쪽 이음부는 접힘선이 없어 접히지 않습니다'));
assert.deepEqual(geometry.makeFoldLines([[[0,0],[1,0],[1,100],[0,100]]],[[[0,11],[1,11],[1,100],[0,100]]],[{x:.5,y:10,r:1}],2,1),[]);
run('s.holeCount=2;draw()');const pdf=run('makePDF()');fs.writeFileSync('/workspace/scratch/strawpick-smooth-qa.pdf',Buffer.from(await pdf.arrayBuffer()));
fs.writeFileSync('/workspace/scratch/strawpick-smooth-qa.png',el('canvas').toBuffer('image/png'));
await run('restoreSnapshot(JSON.stringify({s:{margin:.5,roundness:0,foldLength:8},current:null,original:null}))');
assert.equal(run('s.margin'),1.5);assert.equal(run('s.roundness'),2);assert.equal(run('s.foldLength'),2);
console.log('PASS real canvas: padding-aware centering, roundness cuts silhouette, smooth connected contour, fold display, 12 hole combinations with >=1mm clearance, missing-fold warning and PDF export');

await run("$('demo').onclick()");
assert.equal(run('geo.folds.length'),2,'rounded sample head still supports the fixed fold');

run(`img=document.createElement('canvas');img.width=300;img.height=400;{const q=img.getContext('2d');q.fillStyle='#789c7c';q.beginPath();q.ellipse(150,200,100,150,.2,0,2*Math.PI);q.fill()}current=original='test';s={...defaults};centerComposition();setFlowStep(2);`);
assert.equal(el('foldWarningDialog').open,false,'photo editing never opens a cutline warning');
run("$('finishPhoto').onclick()");
assert.equal(run('geo.folds.length'),2,'curved photo has two safe fixed folds after editing');
assert.equal(el('foldWarningDialog').open,false,'safe curved joints must not open a false warning');
assert.equal(el('foldWarning').hidden,true,'safe curved joints must not show a warning banner');
for(const fold of run('geo.folds')){
 assert(geometry.foldClearance(fold,run('geo.loops'),run('holePositions().map(y=>({x:geo.holeX*P,y:y*P,r:cutDiameter()/2*P}))'))>=10);
}

run(`img=document.createElement('canvas');img.width=300;img.height=400;{const q=img.getContext('2d');q.fillStyle='#789c7c';q.fillRect(149,30,2,340)}current=original='test';s.holeCount=2;centerComposition();flowStep=3;draw();`);
assert.equal(el('foldWarningDialog').open,true,'missing fold opens a message box');
const opens=el('foldWarningDialog').opens;el('foldWarningDialog').close();run('draw()');
assert.equal(el('foldWarningDialog').open,false,'acknowledged warning does not repeat each render');
assert.equal(el('foldWarningDialog').opens,opens);
assert.equal(el('foldWarning').hidden,false,'persistent large warning remains after dismissal');
run("$('showFoldWarning').onclick()");assert.equal(el('foldWarningDialog').open,true,'banner can reopen details');
run('flowStep=2;draw()');assert.equal(el('foldWarningDialog').open,false,'leaving the cutline step closes stale warning');
console.log('PASS missing-fold modal, dismissal without repetition, persistent banner and reopen action');
