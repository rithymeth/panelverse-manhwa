import {NextRequest} from 'next/server';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {dataDir} from '@/lib/db';
import {mimeByExt} from '@/lib/media';
export const runtime='nodejs';
export async function GET(_request:NextRequest,{params}:{params:Promise<{parts:string[]}>}){
  const {parts}=await params;
  if(parts.length!==2 || !/^[a-z0-9-]+$/.test(parts[0]) || !/^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(parts[1])) return new Response('Not found',{status:404});
  const type=mimeByExt(parts[1]); if(!type) return new Response('Not found',{status:404});
  try {const bytes=await readFile(path.join(dataDir(),'uploads',parts[0],parts[1]));return new Response(new Uint8Array(bytes),{headers:{'content-type':type,'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'}});}catch{return new Response('Not found',{status:404});}
}
