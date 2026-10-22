import {NextRequest} from 'next/server';
import {isPublisher,hasPublisherBackend,parsePublication,validatePages,storePublication,getPublishedChapter} from '@/lib/auto-publish';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const authorize=(request:NextRequest)=>{
 if(!isPublisher(request.headers.get('authorization')))return Response.json({error:'Unauthorized'},{status:401});
 if(!hasPublisherBackend())return Response.json({error:'Publisher storage is not configured'},{status:503});
 return null;
};
export async function GET(req:NextRequest){
 const error=authorize(req);if(error)return error;
 const url=new URL(req.url);
 const slug=url.searchParams.get('slug')||'';
 const number=Number(url.searchParams.get('number'));
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Number.isSafeInteger(number)||number<1||number>9999)
  return Response.json({error:'A valid series slug and chapter number are required'},{status:400});
 try{
  const chapter=await getPublishedChapter(slug,number);
  if(!chapter)return Response.json({exists:false,slug,number},{headers:{'Cache-Control':'no-store'}});
  return Response.json({exists:true,slug,number,seriesTitle:chapter.series.title,chapterTitle:chapter.chapter.title,pageCount:chapter.chapter.pages.length,panelCount:chapter.chapter.panelCount,publishedAt:chapter.publishedAt,readerUrl:'/read/'+slug+'/'+number},{headers:{'Cache-Control':'no-store'}});
 }catch(err){console.error('Chapter lookup failed',err);return Response.json({error:'Could not read the current published chapter'},{status:503});}
}
export async function POST(req:NextRequest){
 const error=authorize(req);if(error)return error;
 let raw:unknown,publication;
 try{
  raw=await req.json();
  publication=parsePublication(raw);
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid payload'},{status:400});}
 const body=raw as Record<string,unknown>;
 const mode=body.mode;
 if(mode!==undefined && mode!=='create' && mode!=='replace' && mode!=='upsert')
  return Response.json({error:'Invalid publication mode'},{status:400});
 try{
  const previous=await getPublishedChapter(publication.series.slug,publication.chapter.number);
  if(mode==='create'&&previous)
   return Response.json({error:'Chapter already exists. Choose Replace Chapter to reupload it.',exists:true},{status:409});
  if(mode==='replace'){
   if(!previous)return Response.json({error:'No published chapter exists at this series slug and number. Choose New Chapter instead.'},{status:404});
   const expected=body.expectedPublishedAt;
   if(typeof expected!=='string'||expected!==previous.publishedAt)
    return Response.json({error:'This chapter has changed since you inspected it. Check the chapter again before replacing.',exists:true},{status:409});
   // A replacement must keep the original series metadata and visual identity.
   publication.series={...previous.series};
   const chapterInput=body.chapter as Record<string,unknown>|undefined;
   if(!chapterInput||typeof chapterInput.title!=='string'||!chapterInput.title.trim())
    publication.chapter.title=previous.chapter.title;
   if(!publication.chapter.panelCount)publication.chapter.panelCount=previous.chapter.panelCount;
  }
  await validatePages(publication);
  // Re-check the chapter version after verifying uploaded image assets.
  if(mode==='replace'){
   const latest=await getPublishedChapter(publication.series.slug,publication.chapter.number);
   if(!latest||latest.publishedAt!==body.expectedPublishedAt)
    return Response.json({error:'Another update was published while uploading. Inspect again before replacing.',exists:true},{status:409});
  }
  const saved=await storePublication(publication,previous);
  return Response.json({ok:true,action:previous?'replaced':'created',series:'/series/'+publication.series.slug,chapter:'/read/'+publication.series.slug+'/'+publication.chapter.number,manifestUrl:saved.url,backupUrl:saved.backupUrl||null,pages:publication.chapter.pages.length},{status:previous?200:201,headers:{'Cache-Control':'no-store'}});
 }catch(err){console.error('Manhwa publish failure',err);return Response.json({error:err instanceof Error?err.message:'Publication failed'},{status:422});}
}
