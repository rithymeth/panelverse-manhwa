import path from 'node:path';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dataDir} from './db';
const maxBytes = 12*1024*1024;
function identify(bytes:Uint8Array):{ext:string;type:string}|null{
  if(bytes.length>8 && bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71) return {ext:'png',type:'image/png'};
  if(bytes.length>4 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return {ext:'jpg',type:'image/jpeg'};
  if(bytes.length>12 && Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP') return {ext:'webp',type:'image/webp'};
  if(bytes.length>6 && ['GIF87a','GIF89a'].includes(Buffer.from(bytes.subarray(0,6)).toString())) return {ext:'gif',type:'image/gif'};
  return null;
}
export async function saveImage(file:File, folder:string){
  if(file.size===0||file.size>maxBytes) throw new Error('Each image must be between 1 byte and 12MB');
  const bytes=new Uint8Array(await file.arrayBuffer()); const info=identify(bytes); if(!info) throw new Error('Only PNG, JPEG, WebP and GIF images are supported');
  if(!/^[a-z0-9-]+$/.test(folder)) throw new Error('Invalid folder');
  const base=path.join(dataDir(),'uploads',folder);await fs.mkdir(base,{recursive:true});
  const filename=`${randomUUID()}.${info.ext}`; await fs.writeFile(path.join(base,filename),bytes,{flag:'wx'});
  return {url:`/api/media/${folder}/${filename}`,type:info.type};
}
export function mimeByExt(name:string){return name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':name.endsWith('.gif')?'image/gif':null;}
