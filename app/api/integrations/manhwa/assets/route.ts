import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {put} from '@vercel/blob';
import {isPublisher,hasPublisherBackend} from '@/lib/auto-publish';
export const runtime='nodejs';
const limit=4*1024*1024;
export async function POST(req:NextRequest){
 if(!isPublisher(req.headers.get('authorization')))return Response.json({error:'Unauthorized'},{status:401});
 if(!hasPublisherBackend())return Response.json({error:'Publisher storage is not configured'},{status:503});
 const declared=Number(req.headers.get('content-length')||'0');
 if(!Number.isFinite(declared)||declared>limit)return Response.json({error:'Maximum 4MB per image'},{status:413});
 const kind=req.headers.get('content-type')||'';
 const ext=kind==='image/png'?'png':kind==='image/webp'?'webp':kind==='image/jpeg'?'jpg':'';
 if(!ext)return Response.json({error:'Only PNG, WebP and JPEG supported'},{status:415});
 try{
  const buf=Buffer.from(await req.arrayBuffer());
  if(buf.length<16||buf.length>limit)return Response.json({error:'Invalid image size'},{status:413});
  const valid=ext==='png'?buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='jpg'?buf[0]===255&&buf[1]===216&&buf[2]===255:buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP';
  if(!valid)return Response.json({error:'Invalid image bytes'},{status:422});
  const blob=await put('manhwa/uploads/'+randomUUID()+'.'+ext,buf,{access:'public',contentType:kind,addRandomSuffix:false});
  return Response.json({ok:true,url:blob.url,pathname:blob.pathname},{status:201});
 }catch(e){console.error('Manhwa upload failure',e);return Response.json({error:'Upload failed'},{status:500});}
}