import fs from 'node:fs/promises';
import path from 'node:path';
import {createEditor} from './helpers/editor-harness.mjs';
import {cutouts} from './fixtures/cutouts.mjs';

// Opt-in diagnostic outputs only. Never submits a design or calls a mail API.
const directory=path.resolve(process.env.STRAWPICK_TEST_OUTPUT || 'outputs/cutline-regression');
await fs.mkdir(directory,{recursive:true});
const editor=createEditor(),manifest=[];
for(const [name,fixture] of Object.entries(cutouts)) {
  const geo=editor.load(fixture),{svg,pdf}=await editor.exports();
  await fs.writeFile(path.join(directory,`${name}-preview.png`),editor.el('canvas').toBuffer('image/png'));
  if(svg) await fs.writeFile(path.join(directory,`${name}.svg`),svg);
  if(pdf) await fs.writeFile(path.join(directory,`${name}.pdf`),pdf);
  manifest.push({name,components:geo.contours.length,folds:geo.folds.length,
    clipped:geo.clipped,photoInHole:geo.photoInHole,exported:!!(svg&&pdf)});
}
await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Wrote ${manifest.length} synthetic fixture previews/exports to ${directory}`);
