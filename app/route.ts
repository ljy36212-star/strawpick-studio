import { editorHTML } from "./editor-html";
export const dynamic="force-dynamic";
export function GET(){return new Response(editorHTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}})}
