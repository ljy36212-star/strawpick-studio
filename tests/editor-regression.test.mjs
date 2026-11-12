import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,canvasUnavailable} from './helpers/editor-harness.mjs';
import {cutouts} from './fixtures/cutouts.mjs';
import {assertSimple,edges,nearest,inside,photoBoundary,measuredFoldGap} from './helpers/geometry-oracles.mjs';
import {assertExportParity} from './helpers/export-oracles.mjs';

const options={skip:canvasUnavailable};
// Reuse the real drawing surfaces: dozens of isolated VM/native canvas heaps
// otherwise exhaust small CI workers before the test runner reports a result.
const shared=canvasUnavailable?null:createEditor();
for(const name of ['concave','narrowBridge','asymmetric','residue','enclosedVoid']) {
  for(const diameter of [7,8,9,10,11,12]) for(const count of [1,2]) {
    test(`editor + exports: ${name}, ${diameter}mm, ${count} hole(s)`,options,async()=>{
      const editor=shared,g=editor.load(cutouts[name],{holeDiameter:diameter,holeCount:count});
      assert.equal(g.clipped,false);assert.equal(g.photoInHole,false);
      assert.equal(g.contours.length,1,'one connected exterior; no interior or residue cutlines');
      assertSimple(g.loops);
      const holes=editor.run('holePositions().map(y=>({x:geo.holeX*P,y:y*P,r:cutDiameter()/2*P}))');
      const boundary=photoBoundary(g.photoMask);
      for(const p of boundary) {
        assert(inside(p,g.loops),'the retained photo must be fully inside the final cut');
        for(const h of holes) assert(Math.hypot(p[0]-h.x,p[1]-h.y)>h.r,'holes cannot cut photo pixels');
      }
      assert.equal(g.folds.length,count,'these broad-joint fixtures must support every fold');
      for(const f of g.folds) {
        assert(Math.abs(Math.hypot(f.x2-f.x1,f.y2-f.y1)/10-2)<1e-8,'2mm fold');
        assert(measuredFoldGap(f,g.loops,holes)>=10,'independent minimum clearance to every outer edge and both holes');
        const [a,b]=f.joint;
        assert(Math.abs(f.x1+f.x2-a[0]-b[0])<1e-8 && Math.abs(f.y1+f.y2-a[1]-b[1])<1e-8,'centered on actual joint');
      }
      assert.equal(editor.el('foldWarning').hidden,true);
      const exported=await editor.exports();
      assertExportParity(editor,exported.svg,exported.pdf,diameter,count);
    });
  }
}

test('unsafe narrow seam is omitted, exported without an invented fold, and warned once',options,async()=>{
  const e=createEditor(),g=e.load(cutouts.needle);
  assert.equal(g.folds.length,0);
  assert.equal(e.el('foldWarning').hidden,false);assert.equal(e.el('foldWarningDialog').open,true);
  assert.match(e.el('foldWarningText').textContent,/위쪽·아래쪽/);
  const opens=e.el('foldWarningDialog').opens;e.el('foldWarningDialog').close();e.redraw();
  assert.equal(e.el('foldWarningDialog').open,false);assert.equal(e.el('foldWarningDialog').opens,opens);
  const {svg,pdf}=await e.exports();assertExportParity(e,svg,pdf,7,2);
  assert.match(svg,/<g id="fold-lines"[^>]*><path d=""/);
  e.load(cutouts.residue);assert.equal(e.el('foldWarning').hidden,true);
  e.load(cutouts.needle);assert.equal(e.el('foldWarningDialog').open,true,'new unsafe state warns again');
});

test('out-of-page geometry blocks actual SVG/PDF click handlers',options,async()=>{
  const e=createEditor();e.load(cutouts.asymmetric);
  e.redraw({x:1});assert.equal(e.run('geo.clipped'),true);
  assert.equal(e.el('svg').disabled,true);assert.equal(e.el('pdf').disabled,true);
  assert.deepEqual(await e.exports(),{svg:null,pdf:null});
});

test('restored legacy values enforce 1.5mm margin, 2mm roundness and fixed 2mm folds',options,async()=>{
  const e=createEditor();
  await e.run('restoreSnapshot(JSON.stringify({s:{margin:.5,roundness:0,foldLength:8},current:null,original:null}))');
  assert.equal(e.run('s.margin'),1.5);assert.equal(e.run('s.roundness'),2);assert.equal(e.run('s.foldLength'),2);
});

// Deliberately strict release requirements. Keep failures visible until fixed;
// do not turn these into TODOs, expected passes, or relaxed tolerance checks.
for(const name of ['concave','asymmetric','sharpTip']) {
  test(`RELEASE BLOCKER: final photo margin remains >=1.5mm (${name})`,options,t=>{
    const e=createEditor(),g=e.load(cutouts[name]),segments=edges(g.loops);
    let gap=Infinity;
    for(const p of photoBoundary(g.photoMask)) gap=Math.min(gap,nearest(p,segments));
    t.diagnostic(`measured minimum photo pixel-footprint clearance: ${(gap/10).toFixed(4)}mm`);
    assert(gap>=15-.01,`1.5mm required (0.001mm measurement tolerance); actual ${(gap/10).toFixed(4)}mm`);
  });
}

test('appearance parity: SVG and PDF use equal physical cut/fold stroke widths',options,async()=>{
  const e=createEditor();e.load(cutouts.asymmetric);const {svg,pdf}=await e.exports();
  const pdfText=pdf.toString('latin1');
  const svgCut=+svg.match(/<g fill="none" stroke="#e55399" stroke-width="([^"]+)"/)[1]/10;
  const pdfCut=+pdfText.match(/\/OC \/Cutline BDC\nq\n[^\n]+\n([\d.]+) w/)[1]*25.4/72;
  const svgFold=+svg.match(/id="fold-lines"[^>]*stroke-width="([^"]+)"/)[1]/10;
  const pdfFold=+pdfText.match(/\/OC \/Fold BDC\nq\n[^\n]+\n([\d.]+) w/)[1]*25.4/72;
  assert(Math.abs(svgCut-pdfCut)<.001 && Math.abs(svgFold-pdfFold)<.001,
    `cut SVG/PDF ${svgCut.toFixed(5)}/${pdfCut.toFixed(5)}mm; fold ${svgFold.toFixed(5)}/${pdfFold.toFixed(5)}mm`);
});

test('REVIEW REQUIRED: disconnected retained details are warned about or blocked from export',options,t=>{
  const e=createEditor(),g=e.load(cutouts.detachedDetail);
  assert.equal(g.contours.length,2,'fixture must retain a meaningful separate component, not tiny noise');
  const warned=/분리|떨어|연결되지|독립/.test(e.el('warning').textContent);
  t.diagnostic(`components=${g.contours.length}; exportDisabled=${e.el('svg').disabled}; message=${e.el('warning').textContent}`);
  assert(e.el('svg').disabled || warned,
    'separate pieces need explicit review: do not silently delete meaningful artwork or label it safe');
});
