import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getDb} from '@/lib/db';
import {saveImage} from '@/lib/media';
import {requestIsAdmin,validOrigin,unauthorized,forbidden} from '@/lib/auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 try{
  const sizeHeader=Number(req.headers.get('content-length')||'0');if(sizeHeader>70*1024*1024)return Response.json({error:'Batch exceeds the 70MB limit'},{status:413});
  const form=await req.formData();const kind=String(form.get('kind')||'');const id=String(form.get('id')||'');const db=getDb();
  if(kind==='cover'){
   if(!db.prepare('SELECT id FROM series WHERE id=?').get(id))return Response.json({error:'Series not found'},{status:404});
   const file=form.get('file');if(!(file instanceof File))return Response.json({error:'Choose a cover image'},{status:400});
   const saved=await saveImage(file,'covers');db.prepare('UPDATE series SET cover=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(saved.url,id);return Response.json({ok:true,cover:saved.url});
  }
  if(kind==='pages'){
   if(!db.prepare('SELECT id FROM chapters WHERE id=?').get(id))return Response.json({error:'Chapter not found'},{status:404});
   const files=form.getAll('files').filter((f):f is File=>f instanceof File);if(!files.length || files.length>40)return Response.json({error:'Choose between 1 and 40 images per upload'},{status:400});
   if(files.reduce((total,file)=>total+file.size,0)>70*1024*1024)return Response.json({error:'Batch exceeds the 70MB limit. Upload in smaller groups.'},{status:413});
   files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
   // Write files first, commit their page records as a single transaction.
   const saved: Awaited<ReturnType<typeof saveImage>>[] = []; for (const file of files) saved.push(await saveImage(file,'chapters'));
   const last=(db.prepare('SELECT COALESCE(MAX(position),0) as n FROM pages WHERE chapter_id=?').get(id) as {n:number}).n;
   const insert=db.prepare('INSERT INTO pages (id,chapter_id,position,image) VALUES (?,?,?,?)');db.transaction(()=>saved.forEach((asset,i)=>insert.run(randomUUID(),id,last+i+1,asset.url)))();
   return Response.json({ok:true,added:saved.length});
  }
  return Response.json({error:'Invalid upload type'},{status:400});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Upload failed'},{status:400});}
}
