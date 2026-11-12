import assert from 'node:assert/strict';
import {parseSvgPath,parsePdfPath,assertSvgPdfExterior} from './geometry-oracles.mjs';

export function readExports(svg,pdf) {
  assert(svg && pdf,'real click handlers must produce both SVG and PDF');
  assert.match(svg,/width="50mm" height="70mm" viewBox="0 0 500 700"/);
  const outer=svg.match(/<g id="outer-cutline"><path d="([^"]*)"/)[1];
  const folds=svg.match(/<g id="fold-lines"[^>]*><path d="([^"]*)"/)[1];
  const circles=[...svg.matchAll(/<circle id="hole-\d+" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)]
    .map(m=>({x:+m[1],y:+m[2],r:+m[3]}));
  const text=pdf.toString('latin1');
  assert.match(text,/^%PDF-1\.7/);
  const media=text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  assert(Math.abs(+media[1]*25.4/72-50)<.0001);
  assert(Math.abs(+media[2]*25.4/72-70)<.0001);
  const xref=+text.match(/startxref\n(\d+)/)[1];
  assert.equal(text.slice(xref,xref+4),'xref','byte-accurate PDF xref');
  const rows=text.slice(xref).split('\n'),count=+rows[1].split(' ')[1];
  for(let i=1;i<count;i++) {
    const offset=+rows[i+2].slice(0,10);
    assert(text.slice(offset).startsWith(`${i} 0 obj\n`),`xref object ${i}`);
  }
  const contentId=text.match(/\/Contents (\d+) 0 R/)[1];
  const head=new RegExp(`${contentId} 0 obj\\n<< /Length (\\d+) >>\\nstream\\n`).exec(text);
  assert(head,'uncompressed page content stream');
  const start=head.index+head[0].length,stream=text.slice(start,start+Number(head[1]));
  assert(text.slice(start+Number(head[1])).startsWith('\nendstream'));
  for(const layer of ['Artwork','Cutline','Fold'])assert(stream.includes(`/OC /${layer} BDC`));
  const cuts=stream.match(/\/OC \/Cutline BDC\nq\n[^\n]+\n[^\n]+\n([\s\S]*?)\nS\nQ\nEMC/)[1];
  const fold=stream.match(/\/OC \/Fold BDC\nq\n[^\n]+\n[^\n]+\n([\s\S]*?)\nS\nQ\nEMC/)[1];
  return {outer,folds,circles,stream,cutCommands:parsePdfPath(cuts),foldCommands:fold.trim()?parsePdfPath(fold):[]};
}

export function assertExportParity(editor,svg,pdf,diameter,count) {
  const output=readExports(svg,pdf),{outer,folds,circles,cutCommands,foldCommands}=output;
  const exterior=parseSvgPath(outer);
  assertSvgPdfExterior(exterior,cutCommands.slice(0,exterior.length));
  assert.equal(circles.length,count);
  const preview=editor.strokes.slice(-2);
  assert.equal(preview.length,2,'actual draw() preview strokes');
  const expectedCircle=({x,y,r})=>`M${x+r} ${y}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`;
  assert.equal(preview[0].path,outer+circles.map(expectedCircle).join(''),'Canvas uses serialized SVG exterior and hole circles');
  assert.equal(preview[1].path,folds,'Canvas uses SVG fold coordinates');
  assert.equal(preview[0].transform.a,2);assert.equal(preview[0].transform.d,2);
  const ps=72/254,ptH=70*72/25.4,holes=cutCommands.slice(exterior.length);
  assert.equal(holes.length,count*6,'each PDF hole is move + four cubic arcs + close');
  const g=editor.run('geo');
  for(let i=0;i<count;i++) {
    const circle=circles[i];
    assert(Math.abs(circle.r*2/10-(diameter+.2))<1e-10,'export hole allowance +0.2mm');
    assert(Math.abs(circle.x/10-g.holeX)<1e-10,'same automatic center');
    assert(Math.abs(circle.x-g.bodyBounds.cx)<=1,'automatic center within one mask pixel');
    const commands=holes.slice(i*6,i*6+6);
    assert.equal(commands[0].op,'m');assert.equal(commands[5].op,'h');
    let from=commands[0].args;
    assert(Math.abs(from[0]/ps-(circle.x+circle.r))<.001);
    assert(Math.abs((ptH-from[1])/ps-circle.y)<.001);
    for(const c of commands.slice(1,5)) {
      assert.equal(c.op,'c');
      for(let j=0;j<=20;j++) {
        const t=j/20,p=[0,1].map(k=>(1-t)**3*from[k]+3*(1-t)**2*t*c.args[k]+3*(1-t)*t*t*c.args[k+2]+t**3*c.args[k+4]);
        const radius=Math.hypot(p[0]/ps-circle.x,(ptH-p[1])/ps-circle.y);
        // PDF approximates a circle with four cubics: at r=6.1mm, error <0.002mm.
        assert(Math.abs(radius-circle.r)<.02,'PDF circle within 0.002mm of SVG/Canvas');
      }
      from=c.args.slice(-2);
    }
  }
  const sf=parseSvgPath(folds);
  assert.equal(sf.length,foldCommands.length);
  for(let i=0;i<sf.length;i++) {
    assert.equal(foldCommands[i].op,sf[i].op.toLowerCase());
    const [x,y]=sf[i].args,[px,py]=foldCommands[i].args;
    assert(Math.abs(px-x*ps)<.0001 && Math.abs(py-(ptH-y*ps))<.0001,'PDF fold agrees with SVG/Canvas');
  }
  return output;
}
