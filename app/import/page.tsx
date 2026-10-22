'use client';

import {useEffect,useState} from 'react';
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

type ArchiveResult={manifest:Manifest;images:Uint8Array[];mimes:string[];names:string[];verified:boolean};
function detectMime(bytes:Uint8Array):string{
  if(bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  throw new Error('The ZIP contains an image with an invalid PNG, JPEG or WebP header');
}
async function readArchive(file:File):Promise<ArchiveResult>{
  if(file.size>250*1024*1024)throw new Error('Chapter ZIP must be under 250 MB');
  let zip:JSZip;
  try{zip=await JSZip.loadAsync(file,{checkCRC32:true});}
  catch{throw new Error('Could not open the ZIP. Check that the download completed and the archive is not damaged.');}
  const manifestFile=zip.file('release-manifest.json');
  const reviewFile=zip.file('art-review-v15.json');
  if(Boolean(manifestFile)!==Boolean(reviewFile)){
    throw new Error('This ZIP has incomplete reviewed-release metadata. Export the chapter again; an incomplete review record cannot be bypassed.');
  }
  if(manifestFile && reviewFile){
    // Keep cryptographic checks for plugin-reviewed releases. Invalid proofs never fall back to manual mode.
    let manifest:Manifest;let proof:{schema_version:string;reviewed:boolean;segments:Attestation[]};
    try{manifest=JSON.parse(await manifestFile.async('string')) as Manifest;proof=JSON.parse(await reviewFile.async('string'));}
    catch{throw new Error('The reviewed release contains damaged JSON metadata.');}
    if(manifest.schema_version!=='14.0'||proof.schema_version!=='15.0'||proof.reviewed!==true)throw new Error('Missing required human review approval');
    if(!Array.isArray(manifest.segments)||!manifest.segments.length||manifest.segments.length>300||!Array.isArray(proof.segments)||proof.segments.length!==manifest.segments.length)throw new Error('Missing or excessive chapter segments');
    const verified=new Map<string,Attestation>();
    for(const item of proof.segments){
      if(!item||typeof item.segment_id!=='string'||verified.has(item.segment_id)||typeof item.reviewer!=='string'||!item.reviewer.trim()||!item.checks||reviewFields.some(k=>item.checks[k]!==true))throw new Error('A chapter segment does not have all six human-review checks');
      verified.set(item.segment_id,item);
    }
    const paths=new Set<string>(),images:Uint8Array[]=[],mimes:string[]=[],names:string[]=[];
    let extracted=0;
    for(const seg of manifest.segments){
      if(!seg||typeof seg.id!=='string'||!/^images\/[A-Za-z0-9_-]+\.png$/.test(seg.path)||paths.has(seg.path))throw new Error('Invalid or duplicate page image path');
      paths.add(seg.path);
      if(!/^[0-9a-f]{64}$/.test(seg.sha256)||verified.get(seg.id)?.sha256!==seg.sha256)throw new Error('Artwork differs from reviewed file');
      const entry=zip.file(seg.path);
      if(!entry)throw new Error('Missing image: '+seg.path);
      const declared=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
      if(typeof declared==='number'&&declared>25*1024*1024)throw new Error('Image too large: '+seg.path);
      const bytes=await entry.async('uint8array');
      extracted+=bytes.length;
      if(bytes.length>25*1024*1024||extracted>350*1024*1024)throw new Error('The chapter contains too much uncompressed image data');
      if(detectMime(bytes)!=='image/png'||await digest(bytes)!==seg.sha256)throw new Error('Image checksum or format mismatch: '+seg.path);
      images.push(bytes);mimes.push('image/png');names.push(seg.path);
    }
    return {manifest,images,mimes,names,verified:true};
  }
  // Ordinary chapter ZIPs can be manually reviewed. Never claim they have verified plugin attestations.
  const entries=Object.values(zip.files).filter(entry=>
    !entry.dir &&
    /\.(png|jpe?g|webp)$/i.test(entry.name) &&
    !entry.name.split('/').some(part=>part.startsWith('.')||part==='__MACOSX') &&
    !/(^|\/)(thumbs\.db|desktop\.ini)$/i.test(entry.name)
  ).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  if(!entries.length)throw new Error('No PNG, JPG or WebP images were found in this ZIP. A chapter ZIP must contain image files.');
  if(entries.length>300)throw new Error('A chapter may contain at most 300 images');
  const images:Uint8Array[]=[],mimes:string[]=[],names:string[]=[];
  let extracted=0;
  for(const entry of entries){
    const declared=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
    if(typeof declared==='number'&&declared>25*1024*1024)throw new Error('Image exceeds 25 MB: '+entry.name);
    const bytes=await entry.async('uint8array');
    extracted+=bytes.length;
    if(bytes.length>25*1024*1024||extracted>350*1024*1024)throw new Error('Chapter ZIP is too large when extracted');
    const mime=detectMime(bytes);
    const ext=entry.name.toLowerCase().split('.').pop();
    if((ext==='png'&&mime!=='image/png')||((ext==='jpg'||ext==='jpeg')&&mime!=='image/jpeg')||(ext==='webp'&&mime!=='image/webp'))throw new Error('Image extension does not match its actual format: '+entry.name);
    images.push(bytes);mimes.push(mime);names.push(entry.name);
  }
  return {manifest:{schema_version:'manual-review',total_panels:0,segments:[]},images,mimes,names,verified:false};
}

type ChapterLookup={exists:boolean;slug:string;number:number;seriesTitle?:string;chapterTitle?:string;pageCount?:number;publishedAt?:string;readerUrl?:string};
export default function ImportChapter(){
  const [title,setTitle]=useState('');
  const [publicationMode,setPublicationMode]=useState<'create'|'replace'>('create');
  const [lookup,setLookup]=useState<ChapterLookup|null>(null);
  const [lookingUp,setLookingUp]=useState(false);
  const [previousBackup,setPreviousBackup]=useState('');
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
  const [inspection,setInspection]=useState<{names:string[];verified:boolean}|null>(null);
  const [inspecting,setInspecting]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('mode')==='replace')setPublicationMode('replace');
    const path=params.get('slug')||'';
    if(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path))setSlug(path);
    const ch=params.get('chapter')||'';
    if(/^[1-9][0-9]{0,3}$/.test(ch))setNumber(ch);
    const st=params.get('title')||'';
    if(st.length>=2&&st.length<=150)setTitle(st);
  },[]);
  const destinationSlug=slug.trim().toLowerCase()||title.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const chapterNumber=Number(number);
  const destinationValid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(destinationSlug)&&destinationSlug.length<=96&&Number.isSafeInteger(chapterNumber)&&chapterNumber>0&&chapterNumber<=9999;
  const lookupFresh=lookup!==null&&lookup.slug===destinationSlug&&lookup.number===chapterNumber;
  async function fetchChapter():Promise<ChapterLookup>{
    if(!destinationValid)throw new Error('Enter a valid series slug and chapter number before checking.');
    if(token.length<32)throw new Error('Enter your private publishing token before looking up the chapter.');
    const response=await fetch('/api/integrations/manhwa/publish?slug='+encodeURIComponent(destinationSlug)+'&number='+chapterNumber,{
      headers:{Authorization:'Bearer '+token},cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Could not check the existing chapter.');
    return data as ChapterLookup;
  }
  async function inspectDestination(){
    setLookingUp(true);setMessage('Checking Panelverse for this chapter...');
    try{
      const found=await fetchChapter();
      setLookup(found);
      if(found.exists&&publicationMode==='replace'){
        setTitle(found.seriesTitle||title);
        if(!chapterTitle.trim())setChapterTitle(found.chapterTitle||'Chapter '+chapterNumber);
        setMessage('Found Chapter '+chapterNumber+' with '+found.pageCount+' existing images. Uploading replacement images will update this chapter rather than create a duplicate.');
      }else if(found.exists){
        setMessage('This chapter already exists. Switch to Reupload Existing Chapter to replace its images.');
      }else if(publicationMode==='replace'){
        setMessage('No published chapter found under this series slug and number. Check the slug or choose New Chapter.');
      }else{
        setMessage('Chapter number is available. You can publish it as a new chapter.');
      }
    }catch(e){setLookup(null);setMessage(e instanceof Error?e.message:'Chapter lookup failed');}
    finally{setLookingUp(false);}
  }
  async function inspectZIP(){
    if(!file)return;
    setInspecting(true);setInspection(null);setMessage('Inspecting the ZIP and checking artwork files...');
    try{const archive=await readArchive(file);setInspection({names:archive.names,verified:archive.verified});setMessage(archive.verified?'Verified reviewed release: '+archive.names.length+' images.':'Ordinary chapter ZIP: '+archive.names.length+' images found in filename order. Please check the image sequence and personally review the artwork before publishing.');}
    catch(e){setMessage(e instanceof Error?e.message:'Could not inspect ZIP');}
    finally{setInspecting(false);}
  }
  async function publish(){
    if((mode==='zip'&&!file)||(mode==='images'&&!imageFiles.length)||!title.trim()||!review||token.length<32){setMessage('Choose chapter artwork, enter your title and private token, and confirm your review.');return;}
    if(!destinationValid){setMessage('Enter a valid series slug and chapter number.');return;}
    // Do not upload replacement assets until the existing chapter is identified.
    let existing:ChapterLookup;
    try{existing=await fetchChapter();}catch(e){setMessage(e instanceof Error?e.message:'Could not check chapter');return;}
    setLookup(existing);
    if(publicationMode==='create'&&existing.exists){setMessage('This chapter already exists. Choose Reupload Existing Chapter before replacing it.');return;}
    if(publicationMode==='replace'&&!existing.exists){setMessage('This chapter does not exist. Check its slug and chapter number or select New Chapter.');return;}
    if(publicationMode==='replace'&&(!lookupFresh||!lookup?.exists||lookup.publishedAt!==existing.publishedAt)){
      setMessage('Inspect the existing chapter first and confirm its current details before replacing it.');return;
    }
    const selectedName=mode==='zip'?(file?.name||'chapter ZIP'):(imageFiles.length+' chapter images');
    const confirmation=publicationMode==='replace'
      ?'REUPLOAD AND REPLACE EXISTING CHAPTER?\n\nExisting story: '+existing.seriesTitle+'\nSeries slug: '+destinationSlug+'\nExisting chapter: '+chapterNumber+' — '+existing.chapterTitle+'\nCurrent page images: '+existing.pageCount+'\nReplacement source: '+selectedName+'\n\nThe same chapter URL will be preserved. All existing chapter images will be replaced with the selected artwork. The previous chapter manifest will be backed up.\n\nContinue?'
      :'PUBLISH NEW CHAPTER?\n\nStory: '+title+'\nSeries slug: '+destinationSlug+'\nChapter: '+chapterNumber+'\nArtwork source: '+selectedName+'\n\nContinue?';
    if(!window.confirm(confirmation))return;
    setLoading(true);setChapterUrl('');setPreviousBackup('');
    try{
      let images:Uint8Array[]=[];
      let mimes:string[]=[];
      let totalPanels=0;
      if(mode==='zip'){
        if(!file)throw new Error('Select an approved ZIP');
        setMessage('Checking chapter ZIP and artwork files...');
        const bundle=await readArchive(file);
        images=bundle.images;
        mimes=bundle.mimes;
        setInspection({names:bundle.names,verified:bundle.verified});
        if(!bundle.verified&&!review)throw new Error('Manual artwork review is required for an ordinary chapter ZIP.');
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
        body:JSON.stringify({mode:publicationMode,expectedPublishedAt:publicationMode==='replace'?existing.publishedAt:undefined,reviewApproved:true,series:{slug:destinationSlug,title:publicationMode==='replace'?(existing.seriesTitle||title):title},chapter:{number:chapterNumber,title:chapterTitle||(publicationMode==='replace'?existing.chapterTitle:'Chapter '+chapterNumber),panelCount:totalPanels,pages}})
      });
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error('Chapter publication failed: '+(data.error||response.status));
      setChapterUrl(data.chapter);setPreviousBackup(typeof data.backupUrl==='string'?data.backupUrl:'');setMessage((publicationMode==='replace'?'Existing chapter reuploaded successfully! ':'New chapter published successfully! ')+images.length+' images uploaded.');
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
      <h1 style={{fontSize:38,margin:'10px 0 14px'}}>Publish or reupload a chapter</h1>
      <p style={{lineHeight:1.65,color:'#bab9c4'}}>No separate hosting needed. Upload a <strong>chapter ZIP containing PNG, JPG or WebP images</strong>, a verified Manhwa Artist Coworker release, or individually selected images. Verified releases retain their checksum and review-proof checks. Ordinary ZIPs require your explicit manual artwork review. Check the image order before publishing. Your publishing token is kept in this page's memory only, not saved to the browser.</p>
      <div style={{display:'grid',gap:10,marginTop:25,gridTemplateColumns:'repeat(2,minmax(0,1fr))'}} role="group" aria-label="Publication action">
        <button type="button" disabled={loading} onClick={()=>{setPublicationMode('create');setLookup(null);setMessage('');}} aria-pressed={publicationMode==='create'} style={{padding:'15px 12px',borderRadius:10,border:publicationMode==='create'?'2px solid #b78bff':'1px solid #484155',background:publicationMode==='create'?'#332345':'#1b1924',color:'#f3e7ff',fontWeight:700,cursor:'pointer'}}>New chapter</button>
        <button type="button" disabled={loading} onClick={()=>{setPublicationMode('replace');setLookup(null);setMessage('');}} aria-pressed={publicationMode==='replace'} style={{padding:'15px 12px',borderRadius:10,border:publicationMode==='replace'?'2px solid #b78bff':'1px solid #484155',background:publicationMode==='replace'?'#332345':'#1b1924',color:'#f3e7ff',fontWeight:700,cursor:'pointer'}}>Reupload existing chapter</button>
      </div>
      {publicationMode==='replace'&&<div style={{padding:15,borderRadius:10,marginTop:12,border:'1px solid #5f4b73',background:'#241c2f',fontSize:13,lineHeight:1.7}}>Replace the full image sequence of a chapter already published through Panelverse. Its reader URL stays the same and the previous publication manifest is backed up. <strong>Check the existing chapter first</strong> before selecting Publish.</div>}
      <div style={{display:'grid',gap:20,marginTop:24}}> 
        <label style={labelStyle}>Series title<input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="The Whispering Tower" maxLength={150}/></label>
        <label style={labelStyle}>Series slug {publicationMode==='replace'?'(required to find existing chapter)':'(optional)'}<input style={inputStyle} value={slug} onChange={e=>{setSlug(e.target.value);setLookup(null);}} placeholder="the-immortal-who-only-wanted-a-quiet-life"/></label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:15}}>
          <label style={labelStyle}>Chapter number<input style={inputStyle} type="number" min="1" max="9999" value={number} onChange={e=>{setNumber(e.target.value);setLookup(null);}}/></label>
          <label style={labelStyle}>Chapter title<input style={inputStyle} value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} placeholder="Chapter 1" maxLength={150}/></label>
        </div>
        <label style={labelStyle}>Artwork format
          <select style={inputStyle} value={mode} onChange={e=>setMode(e.target.value==='images'?'images':'zip')}>
            <option value="zip">Chapter ZIP (reviewed release or ordinary images)</option>
            <option value="images">Individual PNG/JPEG/WebP images</option>
          </select>
        </label>
        {mode==='zip'
          ?<div style={{display:'grid',gap:10}}><label style={labelStyle}>Chapter ZIP<input style={inputStyle} type="file" accept=".zip,application/zip" onChange={e=>{setFile(e.target.files?.[0]||null);setInspection(null);setReview(false);setMessage('');}}/></label><button type="button" disabled={!file||inspecting||loading} onClick={inspectZIP} style={{padding:'11px 14px',border:'1px solid #605475',borderRadius:9,background:'#252032',color:'#e8d9ff',fontWeight:650,cursor:'pointer'}}>{inspecting?'Checking ZIP…':'Inspect ZIP & image order'}</button>{inspection&&<div style={{border:'1px solid #4d445b',borderRadius:10,padding:14,background:'#191722',fontSize:13,lineHeight:1.6}}><strong>{inspection.verified?'Verified reviewed-release ZIP':'Ordinary image ZIP — manual review required'}</strong><p style={{color:'#b5a9c5',margin:'6px 0'}}>{inspection.names.length} images sorted for chapter reading. Review the artwork and confirm its order before publishing.</p><ol style={{paddingLeft:21,margin:'8px 0',maxHeight:155,overflow:'auto'}}>{inspection.names.slice(0,60).map((name,i)=><li key={name}>{name}</li>)}{inspection.names.length>60&&<li>…and {inspection.names.length-60} more</li>}</ol></div>}</div>
          :<label style={labelStyle}>Chapter images (up to 300, numbered in reading order)<input style={inputStyle} multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImageFiles(Array.from(e.target.files||[]))}/></label>}
        <label style={labelStyle}>Private Panelverse publish token<input style={inputStyle} type="password" autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);setLookup(null);}} placeholder="Token stored in Vercel" /></label>
        <div style={{display:'grid',gap:10}}>
          <button type="button" disabled={loading||lookingUp||!destinationValid||token.length<32} onClick={inspectDestination} style={{padding:'13px 16px',background:'#282037',border:'1px solid #9274b8',borderRadius:10,color:'#e5d4ff',fontWeight:700,cursor:'pointer'}}>{lookingUp?'Checking existing chapter…':publicationMode==='replace'?'1. Find existing chapter':'Check chapter destination'}</button>
          {lookupFresh&&<div style={{borderRadius:10,padding:15,background:'#1d1a27',border:'1px solid #5b4c68',fontSize:13,lineHeight:1.7}}>
            {lookup.exists?<><strong>Existing Chapter {lookup.number} found</strong><div>{lookup.seriesTitle} — {lookup.chapterTitle}</div><div>{lookup.pageCount} current image(s) · Published {lookup.publishedAt?new Date(lookup.publishedAt).toLocaleString():'previously'}</div>{lookup.readerUrl&&<Link href={lookup.readerUrl} target="_blank" style={{color:'#cbb1ff'}}>View the current chapter ↗</Link>}</>:<strong>No published chapter exists at this slug and number.</strong>}
          </div>}
          {publicationMode==='replace'&&(!lookupFresh||!lookup?.exists)&&<span style={{fontSize:12,color:'#e7bea2'}}>Find and verify the existing chapter before reuploading its images.</span>}
        </div>
        <label style={{display:'flex',gap:12,alignItems:'start',fontSize:14,lineHeight:1.45}}>
          <input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)} style={{marginTop:4}}/>
          I personally reviewed the artwork, character consistency, page order and dialogue, and approved the chapter for publication.
        </label>
        <button onClick={publish} disabled={loading||lookingUp||(publicationMode==='replace'&&(!lookupFresh||!lookup?.exists))} style={{padding:16,border:0,borderRadius:12,background:loading?'#655b70':'#b78bff',color:'#140924',fontWeight:750,fontSize:16,cursor:loading||lookingUp?'wait':'pointer',opacity:publicationMode==='replace'&&(!lookupFresh||!lookup?.exists)?.55:1}}>{loading?'Uploading artwork…':publicationMode==='replace'?'2. Reupload & replace chapter':'Review & publish new chapter'}</button>
      </div>
      {message&&<p role="status" style={{padding:15,borderRadius:10,marginTop:20,background:'#1e202a',lineHeight:1.5}}>{message}</p>}
      {chapterUrl&&<Link href={chapterUrl} style={{color:'#cbacff',display:'block',marginTop:16,fontWeight:700}}>Open published chapter →</Link>}
      {previousBackup&&<a href={previousBackup} rel="noopener noreferrer" target="_blank" style={{color:'#b7aaee',display:'block',marginTop:10,fontSize:12}}>View previous chapter manifest backup ↗</a>}
      <p style={{fontSize:12,color:'#dcb5a7',lineHeight:1.6}}>Use Reupload Existing Chapter when replacing a published chapter. New Chapter will not overwrite an existing chapter. Always verify the series slug and chapter number.</p>
      <p style={{fontSize:12,lineHeight:1.6,color:'#9694a1',marginTop:35}}>Only use this page on the official Panelverse domain. Do not share your publish token. For completely automatic local publishing, use the optional folder watcher included in Manhwa Artist Coworker v16.0.2.</p>
    </div>
  </main>;
}
