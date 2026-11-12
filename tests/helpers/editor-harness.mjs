import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as geometry from '../../public/geometry.js';

const require = createRequire(import.meta.url);
let canvasModule;
for (const name of [
  '@napi-rs/canvas',
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas'),
].filter(Boolean)) {
  try { canvasModule = require(name); break; }
  catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}
export const canvasUnavailable = canvasModule ? false :
  'Not executed: install @napi-rs/canvas (see tests/README.md) or configure CODEX_PRIMARY_RUNTIME_NODE_MODULES';

// DOM controls are stubs; image masks, Canvas paths and PDF bytes use the real app.
// Record actual preview strokes and downloads instead of replacing the exporters.
export function createEditor() {
  if (!canvasModule) throw new Error(canvasUnavailable);
  const {createCanvas, Path2D: NativePath2D, Image} = canvasModule;
  const elements = new Map(), paths = new WeakMap(), strokes = [], downloads = [];
  function Path2D(value) {
    const result = new NativePath2D(value);
    paths.set(result, value);
    return result;
  }
  function el(id) {
    if (!elements.has(id)) {
      const e = ['canvas', 'preview'].includes(id) ? createCanvas(500, 700) : {};
      Object.assign(e, {value: 0, style: {}, dataset: {}, classList: {toggle() {}},
        addEventListener() {}, setAttribute() {}, removeAttribute() {}, getAttribute() {return null;},
        scrollIntoView() {}, checked: true, open: false,
        showModal() {this.open = true; this.opens = (this.opens || 0) + 1;}, close() {this.open = false;}});
      if (id === 'canvas') {
        const context = e.getContext('2d'), stroke = context.stroke.bind(context);
        context.stroke = function(p) {
          strokes.push({path: paths.get(p), transform: context.getTransform(), lineWidth: context.lineWidth});
          return stroke(p);
        };
      }
      elements.set(id, e);
    }
    return elements.get(id);
  }
  const document = {getElementById: el, createElement: tag => tag === 'canvas' ? createCanvas(1, 1) : el(tag),
    querySelector: el, querySelectorAll: () => [], body: {dataset: {}}};
  const context = vm.createContext({...geometry, document, Path2D, Image, console, TextEncoder, Blob, atob,
    setTimeout: () => 1, clearTimeout() {}, URL,
    fetch() {throw new Error('Network calls are forbidden in geometry regression tests');},
    captureDownload(blob, name) {downloads.push({blob, name});}});
  const source = fs.readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
  if (!/^import .* from '\.\/geometry\.js[^']*';\n/.test(source)) throw new Error('Update harness: app import changed');
  vm.runInContext(source.replace(/^import .*\n/, ''), context, {filename: 'public/app.js'});
  const run = code => vm.runInContext(code, context);
  run('download = captureDownload');
  return {run, el, strokes, downloads,
    load(fixture, settings = {}) {
      strokes.length = 0;
      downloads.length = 0;
      const image = createCanvas(fixture.width, fixture.height);
      fixture.draw(image.getContext('2d'));
      context.fixtureImage = image;
      context.fixtureSettings = settings;
      run("s={...defaults,...fixtureSettings};img=fixtureImage;original=current='fixture';centerComposition();flowStep=3;draw()");
      return run('geo');
    },
    redraw(settings = {}) {
      context.fixtureSettings = settings;
      strokes.length = 0;
      run('Object.assign(s,fixtureSettings);draw()');
      return run('geo');
    },
    async exports() {
      downloads.length = 0;
      run("$('svg').onclick();$('pdf').onclick()");
      const svg = downloads.find(x => x.name.endsWith('.svg'));
      const pdf = downloads.find(x => x.name.endsWith('.pdf'));
      return {svg: svg ? await svg.blob.text() : null,
        pdf: pdf ? Buffer.from(await pdf.blob.arrayBuffer()) : null};
    },
  };
}
