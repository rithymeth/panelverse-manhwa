import {NextRequest} from 'next/server';
import {randomUUID,createHash} from 'node:crypto';
import {put} from '@vercel/blob';
import {requestIsAdmin,validOrigin} from '@/lib/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;
const model='gpt-image-2.5-flare';

export async function GET(request:NextRequest){
 const authenticated=requestIsAdmin(request);
 return Response.json({authenticated,configured:authenticated&&Boolean(process.env.OPENAI_API_KEY&&process.env.BLOB_READ_WRITE_TOKEN),model,requiresAdmin:true},
   {headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){
 if(!requestIsAdmin(request))return Response.json({error:'Sign in to Panelverse Admin before generating images.'},{status:401});
 if(!validOrigin(request))return Response.json({error:'Origin verification failed.'},{status:403});
 if(!process.env.OPENAI_API_KEY)return Response.json({error:'Image generation is not connected yet. Add OPENAI_API_KEY to the Vercel Production environment and redeploy.'},{status:503});
 if(!process.env.BLOB_READ_WRITE_TOKEN)return Response.json({error:'Cloud image storage is unavailable.'},{status:503});
 const length=Number(request.headers.get('content-length')||0);
 if(length>12000)return Response.json({error:'Prompt payload exceeds 12 KB.'},{status:413});
 let payload:unknown;
 try{payload=await request.json();}catch{return Response.json({error:'Invalid JSON.'},{status:400});}
 if(!payload||typeof payload!=='object')return Response.json({error:'Invalid generation request.'},{status:400});
 const v=payload as Record<string,unknown>;
 const prompt=v.prompt,slug=v.slug,chapter=v.chapter,panel=v.panel;
 if(typeof prompt!=='string'||prompt.length<20||prompt.length>4200||
    typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80||
    typeof chapter!=='number'||!Number.isSafeInteger(chapter)||chapter<1||chapter>9999||
    typeof panel!=='number'||!Number.isSafeInteger(panel)||panel<1||panel>100)
   return Response.json({error:'Invalid prompt, series slug, chapter or panel number.'},{status:400});
 try{
  const text=[
    'Create one publication-quality vertical FULL COLOR Korean webtoon/manhwa illustration.',
    'Draw precisely ONE sequential storyboard panel; do not make a collage, grid, storyboard contact sheet or multiple separate frames.',
    'Use portrait composition 2:3, finished line art, cinematic lighting and emotionally expressive poses.',
    'Preserve distinctive hairstyles, facial features, ages, clothing, props and environment continuity from the character bible in the prompt.',
    'This artwork is panel '+panel+' of chapter '+chapter+'. Render the described precise narrative moment and camera angle.',
    'Avoid gibberish text, watermarks, logos, UI elements, unrelated character designs and extraneous speech bubbles.',
    'Leave clean negative space for dialogue to be lettered later.',
    prompt
  ].join('\n');
  const abort=AbortSignal.timeout(155000);
  const response=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',
    headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model,prompt:text,n:1,size:'1024x1536',quality:'medium',output_format:'webp',output_compression:78,
      safety_identifier:createHash('sha256').update(process.env.SESSION_SECRET||'panelverse-admin').digest('hex').slice(0,48)}),
    signal:abort,cache:'no-store'
  });
  if(!response.ok){
    let remote:unknown;try{remote=await response.json();}catch{}
    const code=(remote&&typeof remote==='object'&&'error' in remote&&
      typeof (remote as {error?:{code?:unknown}}).error?.code==='string')
      ?(remote as {error:{code:string}}).error.code:'provider_error';
    if(response.status===401)return Response.json({error:'The server OpenAI API key was rejected. Check OPENAI_API_KEY.'},{status:502});
    if(response.status===429)return Response.json({error:'Image generation rate limit or insufficient quota. Check OpenAI API billing and retry later.'},{status:429});
    if(response.status===400)return Response.json({error:code==='moderation_blocked'?'Image request could not be completed; revise the prompt.':'The image provider rejected this request. Check your image model access.',code},{status:422});
    return Response.json({error:'Image generation failed at the provider. Check OpenAI API usage and model access.',code},{status:502});
  }
  const data=await response.json() as {data?:Array<{b64_json?:string}>};
  const encoded=data.data?.[0]?.b64_json;
  if(!encoded||typeof encoded!=='string')return Response.json({error:'Image provider returned no image data.'},{status:502});
  const image=Buffer.from(encoded,'base64');
  if(image.length<1024||image.length>8*1024*1024||image.toString('ascii',0,4)!=='RIFF'||image.toString('ascii',8,12)!=='WEBP')
    return Response.json({error:'Unexpected generated image format or size.'},{status:502});
  const path='manhwa/uploads/'+randomUUID()+'.webp';
  const blob=await put(path,image,{access:'public',contentType:'image/webp',addRandomSuffix:false});
  return Response.json({ok:true,url:blob.url,model,panel,chapter},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(err){
  console.error('Coworker image generation error',err instanceof Error?err.name:'unknown');
  if(err instanceof Error&&err.name==='TimeoutError')return Response.json({error:'Image generation timed out. You can retry this panel; check your API usage before retrying.'},{status:504});
  return Response.json({error:'Generation or storage failed. Check the Vercel runtime logs.'},{status:500});
 }
}
