'use client';

import {useState} from 'react';
import Link from 'next/link';
import JSZip from 'jszip';

type Segment={id:string;path:string;sha256:string};
type Manifest={schema_version:string;total_panels:number;segments:Segment[]};
type Attestation={segment_id:string;sha256:string;reviewer:string;checks:Record<string,boolean>};
const reviewFields=['character_identity','costume_and_props','scene_continuity','complete_panels','dialogue_and_lettering','reading_order'];
const maxImage=4*1024*1024;

async function digest(bytes:Uint8Array):Promise<string>{
  const buffer=new Uint8Array(bytes.byteLength);buffer.set(bytes);
  const sha=await crypto.subtle.digest('SHA-256',buffer.buffer);
  return Array.from(new Uint8Array(sha)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function compact(bytes:Uint8Array,mime='image/png'):Promise<Blob>{
  const b=new Uint8Array(bytes.byteLength);b.set(bytes);
  const original=new Blob([b.buffer],{type:mime});
  if(original.size<=maxImage)return original;
  const bitmap=await createImageBitmap(original);
  try{
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Image conversion unsupported in this browser');
    ctx.drawImage(bitmap,0,0);
    for(const q of [.9,.8,.7,.6,.48]){
      const webp=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',q));
      if(webp?.type==='image/webp'&&webp.size<=maxImage)return webp;
    }
  } finally {bitmap.close();}
  throw new Error('Image exceeds the 4 MB upload limit after compression');
}
async function readArchive(file:File):Promise<{manifest:Manifest;images:Uint8Array[]}>{
  if(file.size>250*1024*1024)throw new Error('Chapter ZIP must be under 250 MB');
  const zip=await JSZip.loadAsync(file,{checkCRC32:true});
  const manifestFile=zip.file('release-manifest.json');
  const reviewFile=zip.file('art-review-v15.json');
  if(!manifestFile||!reviewFile)throw new Error('Use a reviewed v15 manhwa ZIP, not an unreviewed chapter');
  const manifest=JSON.parse(await manifestFile.async('string')) as Manifest;
  const proof=JSON.parse(await reviewFile.async('string')) as {schema_version:string;reviewed:boolean;segments:Attestation[]};
  if(manifest.schema_version!=='14.0'||proof.schema_version!=='15.0'||proof.reviewed!==true)throw new Error('Missing required human review approval');
  if(!Array.isArray(manifest.segments)||!manifest.segments.length||manifest.segments.length>300||!Array.isArray(proof.segments)||proof.segments.length!==manifest.segments.length)throw new Error('Missing or excessive chapter segments');
  const verified=new Map<string,Attestation>();
  for(const item of proof.segments){
    if(!item||typeof item.segment_id!=='string'||verified.has(item.segment_id)||typeof item.reviewer!=='string'||!item.reviewer.trim()||!item.checks||reviewFields.some(k=>item.checks[k]!==true))throw new Error('A chapter segment does not have all six human-review checks');
    verified.set(item.segment_id,item);
  }
  const paths=new Set<string>();
  const images:Uint8Array[]=[];
  for(const seg of manifest.segments){
    if(!seg||typeof seg.id!=='string'||!/^images\/[A-Za-z0-9_-]+\.png$/.test(seg.path)||paths.has(seg.path))throw new Error('Invalid or duplicate page image path');
    paths.add(seg.path);
    if(!/^[0-9a-f]{64}$/.test(seg.sha256)||verified.get(seg.id)?.sha256!==seg.sha256)throw new Error('Artwork differs from reviewed file');
    const entry=zip.file(seg.path);
    if(!entry)throw new Error('Missing image: '+seg.path);
    const bytes=await entry.async('uint8array');
    if(await digest(bytes)!==seg.sha256)throw new Error('Image checksum mismatch: '+seg.path);
    images.push(bytes);
  }
  return {manifest,images};
}
export default function ImportChapter(){
  const [title,setTitle]=useState('');
  const [slug,setSlug]=useState('');
  const [number,setNumber]=useState('1');
  const [chapterTitle,setChapterTitle]=useState('');
  const [token,setToken]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [mode,setMode]=useState<'zip'|'images'>('zip');
  const [imageFiles,setImageFiles]=useState<File[]>([]);
  const [review,setReview]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [chapterUrl,setChapterUrl]=useState('');
  async function publish(){
    if((mode==='zip'&&!file)||(mode==='images'&&!imageFiles.length)||!title.trim()||!review||token.length<32){setMessage('Choose chapter artwork, enter your title and private token, and confirm your review.');return;}
    const chapterNumber=Number(number);
    if(!Number.isSafeInteger(chapterNumber)||chapterNumber<1||chapterNumber>9999){setMessage('Enter a valid chapter number.');return;}
    setLoading(true);setChapterUrl('');
    try{
      let images:Uint8Array[]=[];
      let mimes:string[]=[];
      let totalPanels=0;
      if(mode==='zip'){
        if(!file)throw new Error('Select an approved ZIP');
        setMessage('Checking ZIP integrity and human review proof...');
        const bundle=await readArchive(file);
        images=bundle.images;
        mimes=images.map(()=>'image/png');
        totalPanels=bundle.manifest.total_panels||0;
      }else{
        if(imageFiles.length>300)throw new Error('Limit is 300 images per chapter');
        const files=[...imageFiles].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
        for(const picture of files){
          if(!['image/png','image/jpeg','image/webp'].includes(picture.type))throw new Error('Only PNG, JPEG and WebP pages are supported');
          if(picture.size>25*1024*1024)throw new Error('Each original page must be 25 MB or less');
          const data=new Uint8Array(await picture.arrayBuffer());
          images.push(data);mimes.push(picture.type);
        }
      }
      const pages:string[]=[];
      for(let i=0;i<images.length;i++){
        setMessage('Uploading verified image '+(i+1)+' of '+images.length+'...');
        const body=await compact(images[i],mimes[i]);
        const response=await fetch('/api/integrations/manhwa/assets',{
          method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':body.type},body
        });
        const data=await response.json();
        if(!response.ok||!data.ok||typeof data.url!=='string')throw new Error('Image upload '+(i+1)+' failed: '+(data.error||response.status));
        pages.push(data.url);
      }
      setMessage('Publishing chapter metadata...');
      const response=await fetch('/api/integrations/manhwa/publish',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({reviewApproved:true,series:{slug:slug.trim().toLowerCase()||title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),title},chapter:{number:chapterNumber,title:chapterTitle||'Chapter '+chapterNumber,panelCount:totalPanels,pages}})
      });
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error('Chapter publication failed: '+(data.error||response.status));
      setChapterUrl(data.chapter);setMessage('Chapter published successfully! '+images.length+' images uploaded.');
      setToken('');
    }catch(e){setMessage(e instanceof Error?e.message:'Publication failed');}
    finally{setLoading(false);}
  }
  const inputStyle={width:'100%',padding:'12px 14px',background:'#191b22',border:'1px solid #40414b',borderRadius:10,color:'#fff',fontSize:15} as const;
  const labelStyle={display:'grid',gap:7,fontWeight:600,fontSize:14} as const;
  return <main style={{minHeight:'100vh',background:'#0b0b10',color:'#f9f7ff',padding:'48px 20px',fontFamily:'system-ui,sans-serif'}}>
    <div style={{maxWidth:650,margin:'0 auto'}}>
      <Link href="/" style={{color:'#c7a7ff',textDecoration:'none'}}>← Back to Panelverse</Link>
      <p style={{color:'#bc8cff',letterSpacing:2,fontSize:12,marginTop:36}}>CREATOR TOOLS</p>
      <h1 style={{fontSize:38,margin:'10px 0 14px'}}>Publish a reviewed chapter</h1>
      <p style={{lineHeight:1.65,color:'#bab9c4'}}>No separate hosting needed. Upload either a human-reviewed <strong>Manhwa Artist Coworker ZIP</strong> or individually selected images. For reviewed ZIPs, Panelverse checks the review evidence; for images, you must manually inspect the pages and confirm they are ready. Your publishing token is kept in this page's memory only, not saved to the browser.</p>
      <div style={{display:'grid',gap:20,marginTop:30}}>
        <label style={labelStyle}>Series title<input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="The Whispering Tower" maxLength={150}/></label>
        <label style={labelStyle}>Series slug (optional)<input style={inputStyle} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="the-whispering-tower"/></label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:15}}>
          <label style={labelStyle}>Chapter number<input style={inputStyle} type="number" min="1" max="9999" value={number} onChange={e=>setNumber(e.target.value)}/></label>
          <label style={labelStyle}>Chapter title<input style={inputStyle} value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} placeholder="Chapter 1" maxLength={150}/></label>
        </div>
        <label style={labelStyle}>Artwork format
          <select style={inputStyle} value={mode} onChange={e=>setMode(e.target.value==='images'?'images':'zip')}>
            <option value="zip">Manhwa Artist Coworker reviewed ZIP</option>
            <option value="images">Individual PNG/JPEG/WebP images</option>
          </select>
        </label>
        {mode==='zip'
          ?<label style={labelStyle}>Reviewed chapter ZIP<input style={inputStyle} type="file" accept=".zip,application/zip" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
          :<label style={labelStyle}>Chapter images (up to 300, numbered in reading order)<input style={inputStyle} multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImageFiles(Array.from(e.target.files||[]))}/></label>}
        <label style={labelStyle}>Private Panelverse publish token<input style={inputStyle} type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Token stored in Vercel" /></label>
        <label style={{display:'flex',gap:12,alignItems:'start',fontSize:14,lineHeight:1.45}}>
          <input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)} style={{marginTop:4}}/>
          I personally reviewed the artwork, character consistency, page order and dialogue, and approved the chapter for publication.
        </label>
        <button onClick={publish} disabled={loading} style={{padding:16,border:0,borderRadius:12,background:loading?'#655b70':'#b78bff',color:'#140924',fontWeight:750,fontSize:16,cursor:loading?'wait':'pointer'}}>{loading?'Publishing...':'Verify ZIP & publish chapter'}</button>
      </div>
      {message&&<p role="status" style={{padding:15,borderRadius:10,marginTop:20,background:'#1e202a',lineHeight:1.5}}>{message}</p>}
      {chapterUrl&&<Link href={chapterUrl} style={{color:'#cbacff',display:'block',marginTop:16,fontWeight:700}}>Open published chapter →</Link>}
      <p style={{fontSize:12,lineHeight:1.6,color:'#9694a1',marginTop:35}}>Only use this page on the official Panelverse domain. Do not share your publish token. For completely automatic local publishing, use the optional folder watcher included in Manhwa Artist Coworker v16.0.2.</p>
    </div>
  </main>;
}
