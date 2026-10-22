'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AlertCircle,CheckCircle2,ImagePlus,LockKeyhole,RefreshCw,Square,Play,WandSparkles} from 'lucide-react';

type Panel={id:number;prompt:string;shot:string;beat:string;dialogue:string};
type Config={authenticated:boolean;configured:boolean;model:string};
type Props={panels:Panel[];generated:Record<number,string>;slug:string;chapter:number;onGenerated:(panelId:number,url:string)=>void};
export default function CoworkerGenerator({panels,generated,slug,chapter,onGenerated}:Props){
 const [config,setConfig]=useState<Config|null>(null);
 const [checking,setChecking]=useState(true);
 const [running,setRunning]=useState(false);
 const [message,setMessage]=useState('');
 const [active,setActive]=useState(0);
 const stopRef=useRef(false);
 const aliveRef=useRef(true);
 useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;stopRef.current=true;};},[]);
 async function check(){
  setChecking(true);
  try{const r=await fetch('/api/coworker/generate',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error('Cannot read generator status');setConfig(d);}
  catch{setConfig({authenticated:false,configured:false,model:'gpt-image-2.5-flare'});}
  finally{setChecking(false);}
 }
 useEffect(()=>{void check();},[]);
 const done=panels.filter(p=>Boolean(generated[p.id])).length;
 async function generate(mode:'one'|'five'|'remaining',single?:number){
  if(!config?.authenticated||!config.configured){setMessage('Sign in to the admin account and connect the model API key first.');return;}
  const todo=mode==='one'?panels.filter(p=>p.id===single):panels.filter(p=>!generated[p.id]);
  const queue=mode==='five'?todo.slice(0,5):todo;
  if(!queue.length){setMessage('Every panel has generated artwork.');return;}
  if(!slug){setMessage('Add a valid series title or slug in Story & cast first.');return;}
  const confirmText='Generate '+queue.length+' AI image'+(queue.length===1?'':'s')+'?\n\nThis calls the paid OpenAI API, and each image may incur charges. You can stop after the current image finishes. Previously generated panels will not be overwritten except when you select Regenerate.';
  if(!window.confirm(confirmText))return;
  stopRef.current=false;setRunning(true);setMessage('Starting generation...');
  let completed=0;
  try{
   for(const panel of queue){
    if(stopRef.current)break;
    setActive(panel.id);
    setMessage('Generating panel '+panel.id+' ('+(completed+1)+' of '+queue.length+'). An individual image can take a while.');
    const response=await fetch('/api/coworker/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     slug,chapter,panel:panel.id,prompt:panel.prompt+(panel.dialogue?'\nDialogue/SFX intent: '+panel.dialogue:'')
    })});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok||typeof data.url!=='string'){
      throw new Error('Panel '+panel.id+': '+(data.error||'Image generation failed. You may retry.'));
    }
    onGenerated(panel.id,data.url);
    completed++;
   }
   if(aliveRef.current)setMessage(stopRef.current?'Stopped after '+completed+' image(s). Progress is saved; generate missing panels to resume.':'Generated '+completed+' image(s). Review every panel before publishing.');
  }catch(e){
   if(aliveRef.current)setMessage((e instanceof Error?e.message:'Image generation failed')+' Completed images remain saved. Retry only missing panels.');
  }finally{if(aliveRef.current){setActive(0);setRunning(false);}stopRef.current=false;}
 }
 return <div className="cw-generator" aria-label="AI image generation">
  <div className="cw-generator-title"><div><div className="cw-eyebrow"><WandSparkles size={15}/> REAL AI ARTWORK</div><h3>Generate your panels with AI</h3><p>Turn these storyboard prompts into full-color vertical manhwa images, stored in Panelverse. You can generate one image or continue the remaining chapter.</p></div><span className="cw-generator-count">{done}/{panels.length} GENERATED</span></div>
  {checking?<div className="cw-generator-info">Checking your secure generation connection...</div>:!config?.authenticated?
   <div className="cw-generator-info"><LockKeyhole size={19}/><div><strong>Admin login required</strong><p>Image generation is available only to the website administrator to prevent unauthorized API spending.</p><Link href="/admin/login">Sign in as admin →</Link></div><button type="button" onClick={check}><RefreshCw size={16}/> Check again</button></div>
   :!config.configured?
   <div className="cw-generator-info"><AlertCircle size={19}/><div><strong>Connect an image-generation API key</strong><p>Add <code>OPENAI_API_KEY</code> as an encrypted Production environment variable in Vercel, then redeploy. Your ChatGPT subscription is separate from API billing.</p><a href="https://vercel.com/rithymeths-projects/panelverse-manhwa/settings/environment-variables" target="_blank" rel="noopener noreferrer">Open Vercel settings ↗</a></div><button type="button" onClick={check}><RefreshCw size={16}/> Check again</button></div>
   :<div className="cw-generator-info cw-generator-connected"><CheckCircle2 size={19}/><div><strong>Image model connected: {config.model}</strong><p>Each generated image is a separate API request. Generate a small sample first; review faces and outfits for consistency before generating the full chapter.</p></div></div>}
  <div className="cw-generator-controls">
   <button type="button" disabled={running||!config?.configured||!panels.length} onClick={()=>void generate('one',1)}><ImagePlus size={16}/> {generated[1]?'Regenerate panel 1':'Generate first panel'}</button>
   <button type="button" disabled={running||!config?.configured||done===panels.length} onClick={()=>void generate('five')}><Play size={16}/> Next 5 missing</button>
   <button className="cw-generator-all" type="button" disabled={running||!config?.configured||done===panels.length} onClick={()=>void generate('remaining')}><WandSparkles size={17}/> Generate all missing ({panels.length-done})</button>
   {running&&<button type="button" className="cw-generator-stop" onClick={()=>{stopRef.current=true;setMessage('Stopping after the current panel...');}}><Square size={15}/> Stop after current</button>}
  </div>
  {!!active&&<div className="cw-generator-progress"><span className="cw-pulse"/> Creating panel {active} — images render one at a time. Closing the page may interrupt the batch.</div>}
  {!!message&&<p role="status" className="cw-generator-message">{message}</p>}
  <p className="cw-generator-foot">Images are not automatically approved or published. Review each output before publishing. Generated URLs are saved in this browser for recovery. Regenerations may incur additional charges.</p>
 </div>;
}
