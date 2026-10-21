import {NextRequest} from 'next/server';
import {isPublisher,hasPublisherBackend,parsePublication,validatePages,storePublication} from '@/lib/auto-publish';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!isPublisher(req.headers.get('authorization')))return Response.json({error:'Unauthorized'},{status:401});
 if(!hasPublisherBackend())return Response.json({error:'Publisher storage is not configured'},{status:503});
 let p;
 try{p=parsePublication(await req.json());}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid payload'},{status:400});}
 try{
  await validatePages(p);
  const manifest=await storePublication(p);
  return Response.json({ok:true,series:'/series/'+p.series.slug,chapter:'/read/'+p.series.slug+'/'+p.chapter.number,manifestUrl:manifest,pages:p.chapter.pages.length},{status:201});
 }catch(e){console.error('Manhwa publish failure',e);return Response.json({error:e instanceof Error?e.message:'Publication failed'},{status:422});}
}