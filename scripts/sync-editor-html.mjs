import {readFileSync,writeFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
writeFileSync(new URL('../app/editor-html.ts',import.meta.url),'export const editorHTML = '+JSON.stringify(html)+';\n');
