const RECIPIENT='kjso.printing@gmail.com';
const MAX_BYTES=6*1024*1024;
const RATE_WINDOW=15*60*1000;
const attempts=new Map();
const emailPattern=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
function json(data,status=200,extra={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}})}
function error(message,status=400){return json({ok:false,message},status)}
export function mailReady(env){return Boolean(env.RESEND_API_KEY&&env.EMAIL_FROM)}
async function boundedText(request){const reader=request.body?.getReader();if(!reader)throw Error('empty');let total=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES){await reader.cancel();throw Error('large')}chunks.push(value)}const out=new Uint8Array(total);let at=0;for(const x of chunks){out.set(x,at);at+=x.length}return new TextDecoder().decode(out)}
export async function handleSubmission(request,env,{send=fetch,now=Date.now}={}){
 const url=new URL(request.url);
 if(request.method==='GET'){
   const token=crypto.randomUUID();
   const cookie=`sp_submit=${token}; Path=/api/submissions; HttpOnly; SameSite=Strict; Max-Age=3600${url.protocol==='https:'?'; Secure':''}`;
   return json({ready:mailReady(env),recipient:RECIPIENT,token},200,{'Set-Cookie':cookie});
 }
 if(request.method!=='POST')return error('지원하지 않는 요청이에요.',405);
 if(!mailReady(env))return error('메일 제출 서비스 연결을 준비 중이에요. 잠시 후 다시 이용해주세요.',503);
 if(request.headers.get('Origin')!==url.origin)return error('에디터에서 다시 제출해주세요.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return error('올바른 제출 형식이 아니에요.',415);
 if(Number(request.headers.get('content-length'))>MAX_BYTES)return error('첨부파일이 너무 커요.',413);
 let data;try{data=JSON.parse(await boundedText(request))}catch(e){return error(e.message==='large'?'첨부파일이 너무 커요.':'제출 정보를 읽을 수 없어요.',e.message==='large'?413:400)}
 const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('sp_submit='))?.slice(10);
 if(!token||data.token!==token)return error('제출 화면을 닫고 다시 열어주세요.',403);
 if(data.website)return error('제출 정보를 확인해주세요.');
 const name=typeof data.name==='string'?data.name.trim():'';
 const order=typeof data.order==='string'?data.order.trim():'';
 const reply=typeof data.reply==='string'?data.reply.trim():'';
 const note=typeof data.note==='string'?data.note.trim():'';
 const plain=v=>v.length>0&&v.length<=80&&!/[\x00-\x1f\x7f]/.test(v);
 if(!plain(name)||!plain(order)||reply.length>254||!emailPattern.test(reply)||note.length>1000)return error('주문자명·주문번호·회신 이메일을 확인해주세요.');
 if(!data.agreed)return error('제출 정보 전송에 동의해주세요.');
 const spec=data.spec;
 if(!spec||![1,2].includes(spec.holeCount)||![7,8,9,10,11,12].includes(spec.holeDiameter)||!['화이트','투명','반투명','홀로그램'].includes(spec.material))return error('도안 정보를 확인해주세요.');
 if(typeof data.pdf!=='string'||data.pdf.length>5.6*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.pdf))return error('PDF 첨부파일을 확인해주세요.');
 let pdf;try{pdf=atob(data.pdf)}catch{return error('PDF 첨부파일을 확인해주세요.')}
 if(!pdf.startsWith('%PDF-')||!pdf.slice(-100).includes('%%EOF'))return error('올바른 PDF 도안이 아니에요.');
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('oai-authenticated-user-id')||token;
 const timestamp=now();const previous=attempts.get(ip);const rate=previous&&timestamp-previous.start<RATE_WINDOW?previous:{start:timestamp,count:0};
 if(rate.count>=5)return error('제출 요청이 많아요. 15분 뒤 다시 시도해주세요.',429);
 rate.count++;attempts.set(ip,rate);
 if(attempts.size>2000)for(const [k,v]of attempts)if(timestamp-v.start>RATE_WINDOW)attempts.delete(k);
 const bytes=new TextEncoder().encode(JSON.stringify({name,order,reply,note,spec,pdf:data.pdf}));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const receipt='SP-'+digest.slice(0,12).toUpperCase();
 const text=[`스트로우픽 도안 제출 (${receipt})`,`주문자명: ${name}`,`주문번호: ${order}`,`회신 이메일: ${reply}`,`재질: ${spec.material}`,'작업 크기: 50 × 70mm',`타공: ${spec.holeCount}개 / Ø${spec.holeDiameter}mm`,`타공 칼선: Ø${(spec.holeDiameter+.2).toFixed(1)}mm`,note?`요청사항:\n${note}`:'요청사항: 없음','첨부한 레이어 PDF에서 도안과 칼선을 확인해주세요.'].join('\n');
 try{
  const response=await send('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`strawpick-${digest}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[RECIPIENT],reply_to:reply,subject:`[스트로우픽 도안] ${order} / ${name}`,text,attachments:[{filename:`strawpick-${receipt}-50x70mm.pdf`,content:data.pdf,content_type:'application/pdf'}]}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return error('메일 전송을 완료하지 못했어요. 입력한 내용은 유지되니 잠시 후 다시 제출해주세요.',502);
  const result=await response.json();if(!result.id)return error('메일 전송 결과를 확인하지 못했어요. 다시 제출해주세요.',502);
  return json({ok:true,receipt});
 }catch{return error('전송 결과를 확인하지 못했어요. 같은 내용으로 다시 제출하면 중복 접수를 방지해요.',502)}
}
