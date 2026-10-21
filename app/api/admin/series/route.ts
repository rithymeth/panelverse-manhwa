import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getDb,getSeriesId} from '@/lib/db';
import {requestIsAdmin,validOrigin,unauthorized,forbidden} from '@/lib/auth';
import {safeSlug} from '@/lib/types';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!requestIsAdmin(req))return unauthorized(); if(!validOrigin(req))return forbidden();
 try{
  const b=await req.json(); const title=String(b.title||'').trim().slice(0,120);if(title.length<2)return Response.json({error:'Title must contain at least 2 characters'},{status:400});
  const slug=safeSlug(String(b.slug||title)) || `series-${randomUUID().slice(0,8)}`;
  const id=randomUUID(); const year=Math.max(1990,Math.min(2100,Number(b.year)||new Date().getFullYear()));
  getDb().prepare('INSERT INTO series (id,slug,title,subtitle,description,cover,genres,status,author,artist,year,featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,slug,title,String(b.subtitle||'').slice(0,180),String(b.description||'').slice(0,5000),'',String(b.genres||'Fantasy').split(',').map((g:string)=>g.trim()).filter(Boolean).join(',').slice(0,200),'Ongoing',String(b.author||'').slice(0,120),String(b.artist||'').slice(0,120),year,0);
  return Response.json({ok:true,id,slug});
 }catch(e){if(String(e).includes('UNIQUE'))return Response.json({error:'That slug already exists'},{status:409});return Response.json({error:'Could not create series'},{status:500});}
}
export async function PATCH(req:NextRequest){
 if(!requestIsAdmin(req))return unauthorized();if(!validOrigin(req))return forbidden();
 try{const b=await req.json();const id=String(b.id||'');if(!getSeriesId(id))return Response.json({error:'Series not found'},{status:404});
  const allowed=['title','subtitle','description','genres','status','author','artist','cover','featured'];
  const changes:Record<string,string|number>={};for(const k of allowed){if(b[k]===undefined)continue; if(k==='featured')changes[k]=b[k]?1:0;else changes[k]=(k==='genres'?String(b[k]).split(',').map((g:string)=>g.trim()).filter(Boolean).join(','):String(b[k])).slice(0,k==='description'?5000:500);}
  if(changes.status && !['Ongoing','Completed','Hiatus'].includes(String(changes.status)))return Response.json({error:'Invalid status'},{status:400});
  if(!Object.keys(changes).length)return Response.json({error:'No changes'},{status:400});
  getDb().prepare(`UPDATE series SET ${Object.keys(changes).map(k=>`${k}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...Object.values(changes),id);
  return Response.json({ok:true});
 }catch{return Response.json({error:'Could not update series'},{status:400});}
}
