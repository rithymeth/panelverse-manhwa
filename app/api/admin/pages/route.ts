import {NextRequest} from 'next/server';
import {getDb} from '@/lib/db';
import {requestIsAdmin,validOrigin,unauthorized,forbidden} from '@/lib/auth';
export const runtime='nodejs';
export async function PATCH(req:NextRequest){if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 try{const b=await req.json();const db=getDb();const id=String(b.id||'');const direction=Number(b.direction);
 if(![-1,1].includes(direction))return Response.json({error:'Invalid direction'},{status:400});
 const page=db.prepare('SELECT * FROM pages WHERE id=?').get(id) as {id:string;chapter_id:string;position:number}|undefined;
 if(!page)return Response.json({error:'Page not found'},{status:404});
 const other=db.prepare('SELECT id,position FROM pages WHERE chapter_id=? AND position=?').get(page.chapter_id,page.position+direction) as {id:string;position:number}|undefined;
 if(!other)return Response.json({ok:true});
 db.transaction(()=>{db.prepare('UPDATE pages SET position=? WHERE id=?').run(-page.position,id);db.prepare('UPDATE pages SET position=? WHERE id=?').run(page.position,other.id);db.prepare('UPDATE pages SET position=? WHERE id=?').run(other.position,id);})();
 return Response.json({ok:true});
 }catch{return Response.json({error:'Could not reorder'},{status:400});}}
export async function DELETE(req:NextRequest){if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 const id=new URL(req.url).searchParams.get('id');if(!id)return Response.json({error:'Missing ID'},{status:400});
 const db=getDb();const page=db.prepare('SELECT id,chapter_id FROM pages WHERE id=?').get(id) as {id:string;chapter_id:string}|undefined;if(!page)return Response.json({error:'Not found'},{status:404});
 db.transaction(()=>{db.prepare('DELETE FROM pages WHERE id=?').run(id);const rows=db.prepare('SELECT id FROM pages WHERE chapter_id=? ORDER BY position').all(page.chapter_id) as {id:string}[];rows.forEach((p,i)=>db.prepare('UPDATE pages SET position=? WHERE id=?').run(-(i+1),p.id));rows.forEach((p,i)=>db.prepare('UPDATE pages SET position=? WHERE id=?').run(i+1,p.id));})();
 return Response.json({ok:true});
}
