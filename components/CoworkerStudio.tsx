'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import CoworkerGenerator from './CoworkerGenerator';
import {ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle2,ChevronRight,ClipboardCopy,CloudUpload,Download,FileImage,Film,FolderOpen,ImagePlus,LayoutDashboard,Lightbulb,LockKeyhole,Palette,Plus,RefreshCw,ShieldCheck,Sparkles,Trash2,Users,UploadCloud,WandSparkles,X} from 'lucide-react';

type Tab='overview'|'story'|'storyboard'|'publish';
type Panel={id:number;beat:string;shot:string;prompt:string;dialogue:string};
type Draft={title:string;slug:string;genre:string;chapterTitle:string;chapter:number;outline:string;artStyle:string;characters:string;panelCount:number;panels:Panel[]};
type Artwork={file:File;preview:string};
const storeKey='panelverse:coworker:draft:v1';
const artStoreKey='panelverse:coworker:generated:v1';
const shots=['Establishing wide shot','Medium cinematic shot','Expressive close-up','Low-angle dramatic composition','Over-the-shoulder conversation','Atmospheric environmental detail','Dynamic action framing','Intimate reaction shot'];
const moods=['Quiet anticipation','Subtle tension','Warm connection','Discovery and wonder','High emotional impact','A cinematic transition'];
const beatsOfMotion=['Establish the spatial geography, weather and lighting','Introduce the protagonist entering the scene','Show a small gesture that advances the action','Reveal a meaningful object or location detail','Capture a reaction to the newest information','Shift the viewpoint to the supporting cast or environment','Advance the physical action with a distinct pose','Use a quiet pause or expressive glance','Reveal a new consequence of the scene','End this portion on a visually clear transition'];
const starting:Draft={title:'',slug:'',genre:'Fantasy',chapterTitle:'The Beginning',chapter:1,outline:'A new world appears beyond the morning fog.\nThe hero senses an unfamiliar presence.\nAn unexpected discovery changes everything.\nThe chapter ends on a compelling revelation.',artStyle:'Full-color Korean vertical webtoon, expressive cinematic lighting, beautifully detailed backgrounds, consistent anime-inspired character designs',characters:'',panelCount:30,panels:[]};
const toSlug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const sortNumeric=(a:File,b:File)=>a.name.localeCompare(b.name,undefined,{numeric:true});
function buildPanels(d:Draft):Panel[]{
 const beats=d.outline.split('\n').map(s=>s.trim()).filter(Boolean);
 const safe=beats.length?beats:['Introduce the setting','Establish the main character','Reveal a turning point','End on a cliffhanger'];
 return Array.from({length:d.panelCount},(_,i)=>{
  const index=Math.min(safe.length-1,Math.floor(i*safe.length/d.panelCount));
  const beat=safe[index];const shot=shots[i%shots.length];const moment=beatsOfMotion[i%beatsOfMotion.length];
  return {id:i+1,beat,shot,prompt:[d.artStyle,'Vertical full-color webtoon panel.','Scene: '+beat+'.','Shot: '+shot+'.','Mood: '+moods[i%moods.length]+'.','Distinct story progression: '+moment+'.','Frame '+(i+1)+' of '+d.panelCount+'; do not repeat the previous panel composition.',d.characters?'Character consistency reference: '+d.characters+'.':'Keep the recurring cast consistent.','Crisp linework, expressive poses, legible composition; no dialogue rendered into the art.'].join(' '),dialogue:''};
 });
}
function saveFile(name:string,body:string,mime:string){const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();URL.revokeObjectURL(url);}
async function optimizeImage(file:File):Promise<Blob>{
 const allowed=['image/png','image/jpeg','image/webp'];
 if(!allowed.includes(file.type))throw new Error('Only PNG, JPEG and WebP artwork is supported');
 if(file.size>30*1024*1024)throw new Error(file.name+' exceeds the 30 MB input limit');
 if(file.size<=4*1024*1024)return file;
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser cannot compress this image');
  ctx.drawImage(bitmap,0,0);
  for(const quality of [.9,.8,.7,.6,.5,.4]){
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(blob?.type==='image/webp'&&blob.size<=4*1024*1024)return blob;
  }
 }finally{bitmap.close();}
 throw new Error(file.name+' is too large even after compression');
}
const field=(name:string)=>name.replace(/([A-Z])/g,' $1');
export default function CoworkerStudio(){
 const [draft,setDraft]=useState<Draft>(starting),[tab,setTab]=useState<Tab>('overview'),[ready,setReady]=useState(false);
 const [files,setFiles]=useState<Artwork[]>([]),[token,setToken]=useState(''),[approved,setApproved]=useState(false);
 const [status,setStatus]=useState(''),[publishing,setPublishing]=useState(false),[publishedLink,setPublishedLink]=useState('');
 const [selected,setSelected]=useState(0);
 const [showUpload,setShowUpload]=useState(false);
 const [generated,setGenerated]=useState<Record<number,string>>({});
 useEffect(()=>{try{const raw=localStorage.getItem(storeKey);if(raw){const v=JSON.parse(raw);if(typeof v.title==='string'&&Array.isArray(v.panels))setDraft({...starting,...v,panelCount:Math.min(100,Math.max(1,Number(v.panelCount)||30)),panels:v.panels.slice(0,100)});}}catch{}try{const restored=JSON.parse(localStorage.getItem(artStoreKey)||'{}');if(restored&&typeof restored==='object'&&!Array.isArray(restored)){const map:Record<number,string>={};for(const [id,url] of Object.entries(restored)){const panel=Number(id);if(Number.isSafeInteger(panel)&&panel>0&&panel<=100&&typeof url==='string'&&url.startsWith('https://')&&url.includes('.public.blob.vercel-storage.com/'))map[panel]=url;}setGenerated(map);}}catch{}setReady(true);},[]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(storeKey,JSON.stringify(draft));}catch{}},[draft,ready]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(artStoreKey,JSON.stringify(generated));}catch{}},[generated,ready]);
 useEffect(()=>()=>{files.forEach(f=>URL.revokeObjectURL(f.preview));},[files]);
 const update=(patch:Partial<Draft>)=>setDraft(d=>({...d,...patch}));
 const fill=()=>{if(imageCount>0&&!window.confirm('Rebuilding this storyboard will detach the '+imageCount+' current artwork images from your local project. Already generated images may still incur storage charges. Continue?'))return;setDraft(d=>({...d,slug:d.slug||toSlug(d.title),panels:buildPanels(d)}));setFiles([]);setGenerated({});setApproved(false);setSelected(0);setStatus('Storyboard prompts prepared. Generate AI artwork or upload your own images.');setTab('storyboard');};
 const changePanel=(index:number,patch:Partial<Panel>)=>setDraft(d=>({...d,panels:d.panels.map((p,i)=>i===index?{...p,...patch}:p)}));
 const addArtwork=(added:File[])=>{
  if(!added.length)return;
  const list=[...added].sort(sortNumeric).filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type));
  if(list.length!==added.length){setStatus('Some unsupported files were skipped. Use PNG, JPG or WebP.');}
  if(list.length>100){setStatus('Please select at most 100 chapter images.');return;}
  setFiles(old=>{old.forEach(f=>URL.revokeObjectURL(f.preview));return list.map(file=>({file,preview:URL.createObjectURL(file)}));});
  setApproved(false);setPublishedLink('');
 };
 const imageCount=draft.panels.filter((p,i)=>Boolean(files[i]||generated[p.id])).length;
 const generatedCount=draft.panels.filter((p,i)=>Boolean(!files[i]&&generated[p.id])).length;
 const missingCount=draft.panels.length-imageCount;
 const artworkComplete=draft.panels.length>0&&missingCount===0;
 const complete=artworkComplete&&approved&&token.length>=32&&draft.title.trim().length>=2&&Boolean(draft.slug||toSlug(draft.title));
 const prompts=useMemo(()=>draft.panels.map(p=>`Panel ${p.id} — ${p.shot}\n${p.prompt}${p.dialogue?'\nDialogue: '+p.dialogue:''}`).join('\n\n---\n\n'),[draft.panels]);
 async function publish(){
  if(!complete){setStatus('Every storyboard panel needs a generated or uploaded image. Then approve the artwork review and enter your publish token.');return;}
  if(!window.confirm('Publish Chapter '+draft.chapter+' of '+draft.title+'? Reusing the same series slug and chapter number will replace the previous published version.'))return;
  setPublishing(true);setStatus('Preparing your reviewed chapter…');setPublishedLink('');
  try{
   const urls:string[]=[];
   for(let i=0;i<draft.panels.length;i++){
    const panel=draft.panels[i];
    if(!files[i]&&generated[panel.id]){urls.push(generated[panel.id]);continue;}
    if(!files[i])throw new Error('Missing artwork for panel '+panel.id);
    setStatus(`Uploading manually selected image ${i+1} of ${draft.panels.length}...`);
    const body=await optimizeImage(files[i].file);
    const response=await fetch('/api/integrations/manhwa/assets',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':body.type},body});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok||typeof data.url!=='string')throw new Error(`Panel ${i+1}: ${data.error||'upload failed'}`);
    urls.push(data.url);
   }
   setStatus('Artwork uploaded. Publishing the chapter record…');
   const slug=(draft.slug||toSlug(draft.title)).toLowerCase();
   const response=await fetch('/api/integrations/manhwa/publish',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({reviewApproved:true,series:{slug,title:draft.title,genres:draft.genre,description:draft.outline,artist:'Manhwa Artist Coworker'},chapter:{number:draft.chapter,title:draft.chapterTitle||'Chapter '+draft.chapter,panelCount:draft.panels.length,pages:urls}})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok||typeof data.chapter!=='string')throw new Error(data.error||'Chapter publish failed');
   setPublishedLink(data.chapter);setStatus('Published! Your chapter is available to readers.');setToken('');
  }catch(e){setStatus(e instanceof Error?e.message:'An unexpected publication error occurred. Review the chapter before retrying.');}
  finally{setPublishing(false);}
 }
 const cards=[{id:'overview' as Tab,label:'Workspace',icon:LayoutDashboard},{id:'story' as Tab,label:'Story & cast',icon:Users},{id:'storyboard' as Tab,label:'Storyboard',icon:Film},{id:'publish' as Tab,label:'Publish',icon:CloudUpload}];
 return <div className="cw-shell">
  <aside className="cw-sidebar">
   <Link href="/" className="cw-brand"><span className="cw-brand-icon"><Palette size={22}/></span><span>MANHWA<span> COWORKER</span><small>PANELVERSE CREATOR STUDIO</small></span></Link>
   <p className="cw-side-label">CHAPTER WORKSPACE</p>
   <nav className="cw-nav" aria-label="Coworker sections">{cards.map(({id,label,icon:Icon})=><button key={id} type="button" className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={18}/>{label}<ChevronRight size={14}/></button>)}</nav>
   <div className="cw-side-foot"><div className="cw-side-foot-mark"><Sparkles size={18}/> v1 · WEB STUDIO</div><p>Storyboard planning, character consistency prompts, reviewed artwork and direct Panelverse publishing. Generate AI artwork in the storyboard, review it, and publish. Admin login and an API key are required for AI rendering.</p><Link href="/import">Import a reviewed ZIP <ArrowRight size={15}/></Link></div>
  </aside>
  <div className="cw-main">
   <header className="cw-topbar"><div className="cw-crumb"><Link href="/">Panelverse</Link><ChevronRight size={14}/><span>Manhwa Coworker</span></div><div className="cw-top-actions"><span className="cw-autosaved"><CheckCircle2 size={15}/> Draft saved locally</span><Link className="cw-pill cw-outline" href="/library"><BookOpen size={16}/> My Library</Link></div></header>
   <main className="cw-inner">
    <div className="cw-heading"><div><div className="cw-eyebrow"><Sparkles size={14}/> CREATIVE PRODUCTION DESK</div><h1>Make your next <em>world.</em></h1><p>From story idea to cinematic vertical panels, all the way to your Panelverse readers.</p></div><div className="cw-top-chapter"><small>CURRENT PROJECT</small><strong>{draft.title||'Untitled manhwa'}</strong><span>Chapter {draft.chapter} · {draft.panels.length||0} planned panels</span></div></div>
    {tab==='overview'&&<section className="cw-section">
     <div className="cw-banner"><div className="cw-banner-light"><WandSparkles size={31}/></div><div><small>YOUR STORY STUDIO</small><h2>Build something unforgettable.</h2><p>Start with a story and consistent cast. Prepare sequential prompts, upload your reviewed art, and publish in one place.</p><button className="cw-main-btn" onClick={()=>setTab('story')}>Create a chapter <ArrowRight size={17}/></button></div></div>
     <div className="cw-statrow"><div><strong>{draft.panels.length}</strong><span>Panels outlined</span></div><div><strong>{imageCount}</strong><span>Panels with artwork</span></div><div><strong>{approved?'Ready':'Pending'}</strong><span>Visual review</span></div></div>
     <div className="cw-steps"><h2>Your creative pipeline</h2><div className="cw-steps-grid">{[{icon:Users,title:'01 — Write & design',detail:'Story outline, characters and art direction.',target:'story' as Tab},{icon:Film,title:'02 — Build storyboard',detail:'Generate and refine up to 100 numbered panel prompts.',target:'storyboard' as Tab},{icon:ShieldCheck,title:'03 — Review & publish',detail:'Match artwork with panels, approve, then publish securely.',target:'publish' as Tab}].map(({icon:Icon,title,detail,target})=><button key={title} onClick={()=>setTab(target)} className="cw-step"><Icon size={23}/><h3>{title}</h3><p>{detail}</p><span>Open stage <ArrowRight size={15}/></span></button>)}</div></div>
     <div className="cw-info"><Lightbulb size={19}/><p><strong>About image generation:</strong> This studio now supports real AI image generation. Sign in to Panelverse Admin and connect your image API key to enable it. Each generated image incurs API charges; review artwork before publishing.</p></div>
    </section>}
    {tab==='story'&&<section className="cw-section"><div className="cw-section-title"><div><span>STAGE 01</span><h2>Story & character bible</h2><p>These notes keep outfits, faces, camera composition and storytelling consistent across panels.</p></div></div>
      <div className="cw-form-grid"><label className="cw-field">Series title<input value={draft.title} onChange={e=>update({title:e.target.value})} placeholder="The Last Immortal" maxLength={150}/></label><label className="cw-field">Series slug<input value={draft.slug} onChange={e=>update({slug:toSlug(e.target.value)})} placeholder={toSlug(draft.title)||'my-manhwa'} maxLength={80}/></label><label className="cw-field">Genre<select value={draft.genre} onChange={e=>update({genre:e.target.value})}>{['Fantasy','Cultivation','Action','Sci-Fi','Romance','Isekai','Comedy','Drama','Mystery','Slice of Life'].map(g=><option key={g}>{g}</option>)}</select></label><label className="cw-field">Chapter number<input type="number" min="1" max="9999" value={draft.chapter} onChange={e=>update({chapter:Math.max(1,Math.min(9999,Number(e.target.value)||1))})}/></label><label className="cw-field cw-wide">Chapter title<input value={draft.chapterTitle} onChange={e=>update({chapterTitle:e.target.value})} placeholder="An Unexpected Arrival" maxLength={150}/></label><label className="cw-field cw-wide">Story beats — one scene per line<textarea rows={7} value={draft.outline} onChange={e=>update({outline:e.target.value})} placeholder="A lonely hero arrives at the academy.\nA mysterious event interrupts the class.\nThey discover a secret..."/></label><label className="cw-field cw-wide">Character bible<textarea rows={5} value={draft.characters} onChange={e=>update({characters:e.target.value})} placeholder="Rithy: 19-year-old, short black hair, grey-blue eyes, navy uniform, silver pendant.\nLina: long auburn hair, emerald eyes, white-and-gold academy jacket."/></label><label className="cw-field cw-wide">Visual art direction<textarea rows={3} value={draft.artStyle} onChange={e=>update({artStyle:e.target.value})} placeholder="Full-color vertical Korean manhwa, expressive linework..."/></label><label className="cw-field">Target panel count<select value={draft.panelCount} onChange={e=>update({panelCount:Number(e.target.value)})}>{[10,20,30,40,50,60,80,100].map(v=><option key={v} value={v}>{v} panels</option>)}</select></label></div>
      <div className="cw-form-actions"><button className="cw-main-btn" onClick={fill}><Sparkles size={18}/> Draft {draft.panelCount} panel prompts <ArrowRight size={16}/></button><span>Rebuilding the storyboard clears the current artwork selection.</span></div>
    </section>}
    {tab==='storyboard'&&<section className="cw-section"><div className="cw-section-title cw-section-row"><div><span>STAGE 02</span><h2>Storyboard & panel prompts</h2><p>One cinematic brief per panel. Edit the shot and dialogue, then generate artwork directly with AI.</p></div><button className="cw-pill" onClick={()=>saveFile('panelverse-chapter-'+draft.chapter+'-prompts.txt',prompts,'text/plain')} disabled={!draft.panels.length}><Download size={17}/> Export prompts</button></div>
     {!draft.panels.length?<div className="cw-empty"><Film size={32}/><h3>Your storyboard is waiting.</h3><p>Start with your character bible and story beats to prepare sequential panel prompts.</p><button className="cw-main-btn" onClick={()=>setTab('story')}>Create story <ArrowRight size={17}/></button></div>:<>
      <div className="cw-storybar"><span><CheckCircle2 size={16}/> {draft.panels.length} ordered panels</span><span><Palette size={16}/> {draft.genre} · {draft.chapterTitle}</span><button onClick={()=>{navigator.clipboard.writeText(prompts).then(()=>setStatus('All panel prompts copied.')).catch(()=>setStatus('Clipboard unavailable. Use Export prompts.'));}}><ClipboardCopy size={15}/> Copy all prompts</button></div>
      <CoworkerGenerator panels={draft.panels} generated={generated} slug={draft.slug||toSlug(draft.title)} chapter={draft.chapter} selectedId={draft.panels[selected]?.id||1} onGenerated={(id,url)=>{setGenerated(old=>({...old,[id]:url}));setApproved(false);}}/>
      <div className="cw-panels-grid">{draft.panels.map((p,i)=><button type="button" key={p.id} onClick={()=>setSelected(i)} className={selected===i?'cw-panel active':'cw-panel'}><div className="cw-panel-image">{files[i]||generated[p.id]?<img src={files[i]?.preview||generated[p.id]} alt={'Panel '+p.id+' artwork'}/>:<><Film size={25}/><small>AWAITING ART</small></>}</div><div className="cw-panel-caption"><span>PANEL {String(p.id).padStart(3,'0')}</span><strong>{p.shot}</strong><p>{p.beat}</p></div></button>)}</div>
      <div className="cw-panel-editor"><span className="cw-panel-tag">SELECTED PANEL {selected+1} / {draft.panels.length}</span><h3>Refine the direction</h3><label className="cw-field">Shot / camera<input value={draft.panels[selected]?.shot||''} onChange={e=>changePanel(selected,{shot:e.target.value})}/></label><label className="cw-field">Production prompt<textarea rows={5} value={draft.panels[selected]?.prompt||''} onChange={e=>changePanel(selected,{prompt:e.target.value})}/></label><label className="cw-field">Dialogue / sound effect notes<textarea rows={2} value={draft.panels[selected]?.dialogue||''} onChange={e=>changePanel(selected,{dialogue:e.target.value})} placeholder="Optional lettered dialogue or SFX"/></label><div className="cw-editor-actions"><button className="cw-pill" disabled={selected<=0} onClick={()=>setSelected(v=>v-1)}><ArrowLeft size={15}/> Previous</button><button className="cw-pill" disabled={selected>=draft.panels.length-1} onClick={()=>setSelected(v=>v+1)}>Next <ArrowRight size={15}/></button></div></div>
      <div className="cw-form-actions"><button className="cw-main-btn" onClick={()=>setTab('publish')}>Artwork review & publishing <ArrowRight size={17}/></button></div>
     </>}
    </section>}
    {tab==='publish'&&<section className="cw-section"><div className="cw-section-title"><div><span>STAGE 03</span><h2>Review & publish</h2><p>You do not need to upload anything if you generate your manhwa with AI. Generate every missing panel below, review your artwork and publish.</p></div></div>
      {draft.panels.length>0&&<CoworkerGenerator panels={draft.panels} generated={generated} slug={draft.slug||toSlug(draft.title)} chapter={draft.chapter} selectedId={draft.panels[selected]?.id||1} onGenerated={(id,url)=>{setGenerated(old=>({...old,[id]:url}));setApproved(false);}}/>}
      <div className="cw-review-grid"><div className="cw-review-main">
       <div className="cw-artwork-progress" role="status">
        <div><span className="cw-artwork-label">CHAPTER ARTWORK</span><strong>{imageCount} / {draft.panels.length} panels ready</strong><p>{generatedCount} AI-generated · {imageCount-generatedCount} manually selected · {missingCount} still missing</p></div>
        <div className="cw-artwork-track" role="progressbar" aria-label="Chapter artwork completed" aria-valuemin={0} aria-valuemax={draft.panels.length||1} aria-valuenow={imageCount}><span style={{width:(draft.panels.length?imageCount/draft.panels.length*100:0)+'%'}}/></div>
        {missingCount>0?<p className="cw-artwork-warning">Generate the {missingCount} missing {missingCount===1?'panel':'panels'} with AI above to pass this checklist. Manual upload is not required. The AI generator needs an admin login and a configured image API key.</p>:<p className="cw-artwork-success">All storyboard panels have artwork. Inspect each image below and approve the visual review to continue.</p>}
       </div>
       <div className="cw-optional-upload"><button type="button" aria-expanded={showUpload} onClick={()=>setShowUpload(!showUpload)} className="cw-upload-toggle"><ImagePlus size={18}/>{showUpload?'Hide manual image upload':'I already have images — upload instead (optional)'} <ChevronRight size={18}/></button>
        {showUpload&&<div className="cw-upload-zone"><ImagePlus size={32}/><h3>Optional: upload finished chapter artwork</h3><p>PNG, JPG or WebP. Name files 001.png, 002.png, 003.png, and so on to keep them ordered. Skip this if you generate art with AI.</p><label className="cw-select-button">Choose chapter images<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>addArtwork(Array.from(e.target.files||[]))}/></label><small>Image selection is temporary. Generated artwork is retained in your browser and cloud storage.</small></div>}
       </div>
       {!!imageCount&&<><div className="cw-upload-summary"><strong>{imageCount} / {draft.panels.length} panels have artwork</strong><span>{artworkComplete?'Panel count matches. Review every image before publishing.':'Generate the missing panels above; manual upload is optional.'}</span>{files.length>0&&<button type="button" onClick={()=>{setFiles([]);setApproved(false);}}><Trash2 size={14}/> Clear uploads</button>}</div><div className="cw-review-images">{draft.panels.map((p,i)=>files[i]||generated[p.id]?<div key={p.id}><img src={files[i]?.preview||generated[p.id]} alt={'Panel '+p.id+' artwork'} loading="lazy"/><span>{String(i+1).padStart(3,'0')} · {files[i]?.file.name||'AI-generated'}</span></div>:null)}</div></>}
       <label className="cw-review-consent"><input type="checkbox" checked={approved&&artworkComplete} disabled={!artworkComplete} onChange={e=>setApproved(e.target.checked)}/><span><strong>I reviewed every chapter image.</strong><small>{artworkComplete?'All artwork is complete. Confirm character identity, continuity, dialogue placement and reading order before you approve.':'This checkbox becomes available when every planned panel has generated or uploaded artwork.'}</small></span></label>
       <label className="cw-field">Private publishing token<input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} placeholder="Your PANELVERSE_PUBLISH_TOKEN (never saved)"/></label><div className="cw-security-note"><LockKeyhole size={16}/> Your token is only kept in browser memory during this session. Do not share it or publish from an untrusted device.</div>
       <button className="cw-main-btn cw-publish-btn" disabled={!complete||publishing} onClick={publish}><UploadCloud size={19}/>{publishing?'Uploading artwork…':'Publish chapter to Panelverse'}</button><Link href={'/import?mode=replace&slug='+encodeURIComponent(draft.slug||toSlug(draft.title))+'&chapter='+draft.chapter+'&title='+encodeURIComponent(draft.title)} className="cw-pill" style={{justifyContent:'center',marginTop:8}}><RefreshCw size={16}/> Reupload or replace an existing chapter</Link>
       {status&&<div className="cw-feedback" role="status">{status}</div>}
       {publishedLink&&<Link href={publishedLink} className="cw-published-link">Open published chapter <ArrowRight size={17}/></Link>}
      </div>
      <div className="cw-review-aside"><h3>Release checklist</h3>{[{label:'Storyboard prepared',yes:draft.panels.length>0},{label:'All panels have artwork (AI or uploaded)',yes:artworkComplete},{label:'Visual review approved',yes:artworkComplete&&approved},{label:'Secure publish token entered',yes:token.length>=32}].map(item=><div className="cw-check" key={item.label}><span className={item.yes?'yes':''}>{item.yes?<Check size={14}/>:<span>○</span>}</span>{item.label}</div>)}<div className="cw-release-note"><ShieldCheck size={22}/><h4>Safe release</h4><p>Publishing is authenticated. Reusing the same chapter number replaces its existing online version, so double-check the project and numbering.</p></div><button className="cw-pill" onClick={()=>setTab('storyboard')}><Film size={15}/> Back to storyboard</button></div></div>
    </section>}
    <footer className="cw-footer"><span>MANHWA COWORKER · PANELVERSE</span><span>Your creative work belongs to you.</span></footer>
   </main>
  </div>
 </div>;
}
