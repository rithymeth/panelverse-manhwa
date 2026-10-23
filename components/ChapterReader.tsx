'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ChevronLeft,ChevronRight,ArrowUp,BookOpen,Menu,X,BookmarkCheck} from 'lucide-react';
import type {Page,Chapter} from '@/lib/types';

type ReadingCheckpoint={
  y:number;
  ratio:number;
  pageIndex:number;
  pageOffset:number;
  dimensions:(string|null)[];
  updatedAt:number;
};

export default function ChapterReader({series,chapter,chapters,pages}:{series:{slug:string;title:string};chapter:Chapter;chapters:Chapter[];pages:Page[]}){
 const [progress,setProgress]=useState(0);
 const [menu,setMenu]=useState(false);
 const [restored,setRestored]=useState(false);
 const [ratios,setRatios]=useState<Record<number,string>>({});
 const idx=chapters.findIndex(c=>c.id===chapter.id),prev=chapters[idx+1],next=chapters[idx-1];

 useEffect(()=>{
  const checkpointKey='panelverse:reading-position:v1:'+series.slug+':'+chapter.number;
  const latestKey='panelverse:last-read:v1';
  const recentKey='panelverse:recent-series';
  let checkpoint:ReadingCheckpoint|null=null;
  try{
   const raw=localStorage.getItem(checkpointKey);
   if(raw){
    const parsed=JSON.parse(raw) as ReadingCheckpoint;
    if(parsed&&typeof parsed.y==='number'&&Number.isFinite(parsed.y)&&parsed.y>=0&&
       typeof parsed.ratio==='number'&&Number.isFinite(parsed.ratio)&&parsed.ratio>=0&&parsed.ratio<=1&&
       typeof parsed.updatedAt==='number'&&Date.now()-parsed.updatedAt<180*24*60*60*1000){
      checkpoint=parsed;
      if(Array.isArray(parsed.dimensions)){
       const nextRatios:Record<number,string>={};
       parsed.dimensions.forEach((d,i)=>{if(typeof d==='string'&&/^\d{1,5} \/ \d{1,5}$/.test(d))nextRatios[i]=d;});
       setRatios(nextRatios);
      }
     }
   }
  }catch{}
  try{
   const now=Date.now();
   localStorage.setItem(latestKey,JSON.stringify({slug:series.slug,title:series.title,chapter:chapter.number,at:now}));
   const raw=JSON.parse(localStorage.getItem(recentKey)||'[]');
   const previous=Array.isArray(raw)?raw.filter(item=>item&&typeof item.slug==='string'&&item.slug!==series.slug):[];
   localStorage.setItem(recentKey,JSON.stringify([{slug:series.slug,chapter:chapter.number,at:now},...previous].slice(0,40)));
   window.dispatchEvent(new Event('panelverse:library-updated'));
  }catch{}

  let restoreActive=Boolean(checkpoint&&checkpoint.y>100);
  let userInteracted=false;
  let saveTimer:number|undefined;
  const restoreTimers:number[]=[];
  const images=Array.from(document.querySelectorAll<HTMLImageElement>('.webtoon-pages img'));
  const getRatio=()=>{
   const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
   return max>0?Math.min(1,Math.max(0,window.scrollY/max)):0;
  };
  const renderProgress=()=>setProgress(Math.round(getRatio()*100));
  const save=()=>{
   if(restoreActive&&!userInteracted)return;
   try{
    const y=Math.max(0,window.scrollY),reference=y+Math.min(200,window.innerHeight*.35);
    let pageIndex=-1,pageOffset=0;
    images.forEach((img,i)=>{
     const top=img.getBoundingClientRect().top+window.scrollY;
     const height=img.getBoundingClientRect().height;
     if(height>0&&top<=reference&&reference<=top+height){
      pageIndex=i;pageOffset=Math.min(1,Math.max(0,(reference-top)/height));
     }
    });
    const dimensions=images.map((img,i)=>
     img.naturalWidth>0&&img.naturalHeight>0
      ?String(img.naturalWidth)+' / '+String(img.naturalHeight)
      :(checkpoint?.dimensions?.[i]||null)
    );
    checkpoint={y,ratio:getRatio(),pageIndex,pageOffset,dimensions,updatedAt:Date.now()};
    localStorage.setItem(checkpointKey,JSON.stringify(checkpoint));
   }catch{}
  };
  const scheduleSave=()=>{
   if(saveTimer!==undefined)window.clearTimeout(saveTimer);
   saveTimer=window.setTimeout(()=>{saveTimer=undefined;save();},500);
  };
  const onScroll=()=>{renderProgress();if(!restoreActive||userInteracted)scheduleSave();};
  const onLeave=()=>{if(saveTimer!==undefined)window.clearTimeout(saveTimer);saveTimer=undefined;save();};
  const onVisibility=()=>{if(document.visibilityState==='hidden')onLeave();};
  const onInteraction=()=>{userInteracted=true;restoreActive=false;};
  const restore=()=>{
   if(!checkpoint||userInteracted)return;
   let y=checkpoint.y;
   if(Number.isSafeInteger(checkpoint.pageIndex)&&checkpoint.pageIndex>=0&&checkpoint.pageIndex<images.length){
    const img=images[checkpoint.pageIndex];
    const height=img.getBoundingClientRect().height;
    if(height>0){
     const top=img.getBoundingClientRect().top+window.scrollY;
     y=Math.max(0,top+height*checkpoint.pageOffset-Math.min(200,window.innerHeight*.35));
    }
   }
   const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
   if(max>0){
    // Saved pixel/page position comes first; ratio handles revised page dimensions.
    const target=Math.min(max,Math.max(0,y));
    const old=document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior='auto';
    window.scrollTo(0,target);
    document.documentElement.style.scrollBehavior=old;
    renderProgress();
   }
  };
  const onImageLoad=()=>{if(restoreActive&&!userInteracted)restore();};
  images.forEach(img=>img.addEventListener('load',onImageLoad));
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('pagehide',onLeave);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('wheel',onInteraction,{passive:true});
  window.addEventListener('touchstart',onInteraction,{passive:true});
  window.addEventListener('pointerdown',onInteraction,{passive:true});
  const key=(e:KeyboardEvent)=>{
   if(['ArrowDown','ArrowUp','PageDown','PageUp',' ','Home','End'].includes(e.key))onInteraction();
   if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return;
   if(e.key==='ArrowRight'&&next)location.href='/read/'+series.slug+'/'+next.number;
   if(e.key==='ArrowLeft'&&prev)location.href='/read/'+series.slug+'/'+prev.number;
   if(e.key==='Escape')setMenu(false);
  };
  window.addEventListener('keydown',key);
  renderProgress();
  if(restoreActive){
   setRestored(true);
   // Images and stored aspect ratios can change layout during hydration and lazy loading.
   for(const delay of [60,250,650,1300,2200])restoreTimers.push(window.setTimeout(restore,delay));
   restoreTimers.push(window.setTimeout(()=>{restoreActive=false;renderProgress();},2700));
  }else{
   setRestored(false);
   scheduleSave();
  }
  return ()=>{
   onLeave();
   if(saveTimer!==undefined)window.clearTimeout(saveTimer);
   restoreTimers.forEach(timer=>window.clearTimeout(timer));
   images.forEach(img=>img.removeEventListener('load',onImageLoad));
   window.removeEventListener('scroll',onScroll);
   window.removeEventListener('pagehide',onLeave);
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('wheel',onInteraction);
   window.removeEventListener('touchstart',onInteraction);
   window.removeEventListener('pointerdown',onInteraction);
   window.removeEventListener('keydown',key);
  };
 },[series.slug,series.title,chapter.number,next?.number,prev?.number,pages.length]);

 return <div className="reader-shell">
  <div className="reader-progress" role="progressbar" aria-label="Chapter reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:progress+'%'}}/></div>
  <header className="reader-header">
   <div className="reader-header-left">
    <Link href={'/series/'+series.slug} className="reader-back" aria-label="Back to series"><ChevronLeft size={19}/></Link>
    <div><Link className="reader-series-link" href={'/series/'+series.slug}>{series.title}</Link><div className="reader-chapter-title">Chapter {chapter.number}: {chapter.title}</div></div>
   </div>
   <div className="reader-header-right"><span className="reader-counter">{progress}% read</span><Link className="pv-reader-library-link" href="/library"><BookmarkCheck size={15}/> My Library</Link><button className="icon-action" aria-label="Chapter list" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button></div>
  </header>
  {menu&&<aside className="reader-menu"><h3>All chapters</h3>{chapters.map(c=><Link onClick={()=>setMenu(false)} className={c.id===chapter.id?'selected':''} key={c.id} href={'/read/'+series.slug+'/'+c.number}>Chapter {c.number} <span>{c.title}</span></Link>)}</aside>}
  {restored&&<div className="pv-reader-resumed" role="status"><BookmarkCheck size={15}/> Your last reading position has been restored.<button type="button" onClick={()=>{setRestored(false);window.scrollTo({top:0,behavior:'smooth'});}}>Start from top</button><button type="button" aria-label="Dismiss notice" onClick={()=>setRestored(false)}><X size={15}/></button></div>}
  <main className="reader-content">
   <div className="reader-intro"><span>NOW READING</span><h1>Chapter {chapter.number}</h1><p>{chapter.title}</p><div className="reader-divider">✦</div></div>
   <div className="webtoon-pages">{pages.map((p,i)=><img key={p.id} src={p.image} alt={series.title+' Chapter '+chapter.number+' – page '+(i+1)} loading={i===0?'eager':'lazy'} decoding="async" draggable={false} style={ratios[i]?{aspectRatio:ratios[i]}:undefined}/>)}</div>
   <div className="reader-end"><span className="end-icon">✦</span><h2>End of chapter {chapter.number}</h2><p>Every story deserves another page.</p><div className="reader-cta">{prev?<Link href={'/read/'+series.slug+'/'+prev.number} className="btn btn-outline"><ChevronLeft size={18}/> Previous</Link>:<Link href={'/series/'+series.slug} className="btn btn-outline"><BookOpen size={18}/> Series details</Link>}{next?<Link href={'/read/'+series.slug+'/'+next.number} className="btn btn-primary">Next chapter <ChevronRight size={18}/></Link>:<Link href={'/series/'+series.slug} className="btn btn-primary">Back to series <ChevronRight size={18}/></Link>}</div></div>
  </main>
  <button className="reader-to-top" aria-label="Back to top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><ArrowUp size={19}/></button>
 </div>;
}
