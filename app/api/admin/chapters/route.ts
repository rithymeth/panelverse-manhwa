import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getDb,getSeriesId} from '@/lib/db';
import {requestIsAdmin,validOrigin,unauthorized,forbidden} from '@/lib/auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 try{const b=await req.json();const seriesId=String(b.seriesId||'');const number=Number(b.number);if(!getSeriesId(seriesId))return Response.json({error:'Series not found'},{status:404});if(!Number.isSafeInteger(number)||number<1||number>100000)return Response.json({error:'Chapter number must be a positive integer'},{status:400});
 const id=randomUUID();getDb().prepare('INSERT INTO chapters (id,series_id,number,title,status) VALUES (?,?,?,?,?)').run(id,seriesId,number,String(b.title||`Chapter ${number}`).slice(0,120),'draft');return Response.json({ok:true,id});
 }catch(e){return Response.json({error:String(e).includes('UNIQUE')?'This chapter number already exists':'Could not create chapter'},{status:400});}}
export async function PATCH(req:NextRequest){if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 try{const b=await req.json(),id=String(b.id||'');const db=getDb();const c=db.prepare('SELECT id FROM chapters WHERE id=?').get(id);if(!c)return Response.json({error:'Chapter not found'},{status:404});
 if(b.status==='published'){
  const count=(db.prepare('SELECT COUNT(*) AS n FROM pages WHERE chapter_id=?').get(id) as {n:number}).n;if(count===0)return Response.json({error:'Upload at least one page before publishing'},{status:400});
  db.prepare("UPDATE chapters SET status='published',published_at=COALESCE(published_at,CURRENT_TIMESTAMP) WHERE id=?").run(id);
 }else if(b.status==='draft'){db.prepare("UPDATE chapters SET status='draft' WHERE id=?").run(id);}else if(typeof b.title==='string'){db.prepare('UPDATE chapters SET title=? WHERE id=?').run(b.title.slice(0,120),id);}else return Response.json({error:'Invalid update'},{status:400});
 return Response.json({ok:true});}catch{return Response.json({error:'Could not update chapter'},{status:400});}}
