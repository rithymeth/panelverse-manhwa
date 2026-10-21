import {head,list,put} from '@vercel/blob';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {getDb} from './db';
type SeriesIn={slug:string;title:string;subtitle:string;description:string;genres:string;status:string;author:string;artist:string;cover:string};
type ChapterIn={number:number;title:string;panelCount:number;pages:string[]};
export type Publication={schema:1;series:SeriesIn;chapter:ChapterIn;publishedAt:string};
const prefix='manhwa/chapters/';
const slugOk=(s:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const val=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export function hasPublisherBackend(){return Boolean(process.env.BLOB_READ_WRITE_TOKEN&&process.env.PANELVERSE_PUBLISH_TOKEN);}
export function isPublisher(auth:string|null){
 const key=process.env.PANELVERSE_PUBLISH_TOKEN;
 if(!key||key.length<32||!auth?.startsWith('Bearer '))return false;
 const supplied=auth.slice(7);
 if(supplied.length!==key.length)return false;
 return timingSafeEqual(createHash('sha256').update(supplied).digest(),createHash('sha256').update(key).digest());
}
export function parsePublication(input:unknown):Publication{
 if(!input||typeof input!=='object')throw new Error('Invalid payload');
 const req=input as Record<string,unknown>;
 if(req.reviewApproved!==true)throw new Error('Explicit visual review required before publication');
 const s=(req.series||{}) as Record<string,unknown>, c=(req.chapter||{}) as Record<string,unknown>;
 const slug=val(s.slug,96).toLowerCase(), title=val(s.title,150),num=c.number,pages=c.pages;
 if(!slugOk(slug)||title.length<2)throw new Error('Invalid series slug or title');
 if(typeof num!=='number'||!Number.isSafeInteger(num)||num<1||num>9999)throw new Error('Invalid chapter number');
 if(!Array.isArray(pages)||pages.length<1||pages.length>300||!pages.every(p=>typeof p==='string'&&p.length<1000)||new Set(pages).size!==pages.length)throw new Error('Expected 1–300 unique image URLs');
 return {schema:1,series:{slug,title,subtitle:val(s.subtitle,180),description:val(s.description,5000),genres:val(s.genres,250)||'Fantasy',status:'Ongoing',author:val(s.author,120)||'Independent Creator',artist:val(s.artist,120)||'Manhwa Artist Coworker',cover:val(s.cover,1000)},chapter:{number:num,title:val(c.title,150)||'Chapter '+num,panelCount:Math.max(0,Math.min(300,Number(c.panelCount)||0)),pages:[...pages]},publishedAt:new Date().toISOString()};
}
export async function validatePages(p:Publication){
 for(const url of p.chapter.pages){
  let u:URL;try{u=new URL(url);}catch{throw new Error('Invalid page URL');}
  if(u.protocol!=='https:'||!u.hostname.endsWith('.public.blob.vercel-storage.com')||!u.pathname.startsWith('/manhwa/uploads/'))throw new Error('Images must first be uploaded to Panelverse');
  const obj=await head(url);
  if(!obj.pathname.startsWith('manhwa/uploads/')||!obj.contentType.startsWith('image/'))throw new Error('Invalid image asset');
 }
 if(!p.series.cover)p.series.cover=p.chapter.pages[0];
 else if(!p.series.cover.startsWith('/covers/')&&!p.chapter.pages.includes(p.series.cover))throw new Error('Cover URL not approved');
}
export async function storePublication(p:Publication){
 const pathname=prefix+p.series.slug+'/'+String(p.chapter.number).padStart(4,'0')+'.json';
 return (await put(pathname,JSON.stringify(p),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60})).url;
}
let lastSync=0;let inflight:Promise<void>|undefined;
async function syncFromBlobs(){
 let cursor:string|undefined;const objects:{url:string}[]=[];
 do {const page=await list({prefix,limit:500,cursor});objects.push(...page.blobs);if(objects.length>3000)throw new Error('Catalog import limit');cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 const db=getDb();
 for(let start=0;start<objects.length;start+=10){
  const records=await Promise.all(objects.slice(start,start+10).map(async blob=>{const res=await fetch(blob.url,{cache:'no-store'});if(!res.ok)throw new Error('Publication metadata unavailable');return await res.json() as Publication;}));
  db.transaction(()=>{
   for(const item of records){
    if(item.schema!==1||!item.series||!item.chapter||!slugOk(item.series.slug)||!Number.isSafeInteger(item.chapter.number)||!Array.isArray(item.chapter.pages))continue;
    const s=item.series,c=item.chapter;
    const existing=db.prepare('SELECT id FROM series WHERE slug=?').get(s.slug) as {id:string}|undefined;
    const sid=existing?.id||randomUUID();
    if(!existing)db.prepare('INSERT INTO series (id,slug,title,subtitle,description,cover,genres,status,author,artist,year,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(sid,s.slug,s.title,s.subtitle,s.description,s.cover,s.genres,s.status,s.author,s.artist,new Date().getFullYear(),0);
    else db.prepare('UPDATE series SET title=?,subtitle=?,description=?,cover=?,genres=?,author=?,artist=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(s.title,s.subtitle,s.description,s.cover,s.genres,s.author,s.artist,sid);
    const prior=db.prepare('SELECT id FROM chapters WHERE series_id=? AND number=?').get(sid,c.number) as {id:string}|undefined;
    const cid=prior?.id||randomUUID();
    if(prior)db.prepare('UPDATE chapters SET title=?,status=?,published_at=? WHERE id=?').run(c.title,'published',item.publishedAt,cid);
    else db.prepare('INSERT INTO chapters (id,series_id,number,title,status,published_at) VALUES(?,?,?,?,?,?)').run(cid,sid,c.number,c.title,'published',item.publishedAt);
    db.prepare('DELETE FROM pages WHERE chapter_id=?').run(cid);
    const add=db.prepare('INSERT INTO pages (id,chapter_id,position,image) VALUES (?,?,?,?)');
    c.pages.forEach((url,i)=>add.run(randomUUID(),cid,i+1,url));
   }
  })();
 }
}
export async function syncPublishedManhwa(){
 if(!process.env.BLOB_READ_WRITE_TOKEN||Date.now()-lastSync<15000)return;
 if(!inflight)inflight=syncFromBlobs().then(()=>{lastSync=Date.now();}).finally(()=>{inflight=undefined;});
 try{await inflight;}catch(e){console.error('Manhwa catalog sync failed:',e);}
}