'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {BookOpen,Bookmark,ArrowUpRight,Clock3,Compass,Trash2} from 'lucide-react';
import type {Series} from '@/lib/types';
import SaveSeriesButton from './SaveSeriesButton';
type Recent={slug:string;chapter:number;at:number};
type Tab='continue'|'saved';
const savedKey='panelverse:saved-series',recentKey='panelverse:recent-series';
export default function LibraryClient({series}:{series:Series[]}){
 const [ready,setReady]=useState(false),[saved,setSaved]=useState<string[]>([]),[recent,setRecent]=useState<Recent[]>([]),[tab,setTab]=useState<Tab>('continue');
 useEffect(()=>{
  const refresh=()=>{try{const ids=JSON.parse(localStorage.getItem(savedKey)||'[]');setSaved(Array.isArray(ids)?ids.filter((x):x is string=>typeof x==='string'):[]);}catch{setSaved([]);}
   try{const items=JSON.parse(localStorage.getItem(recentKey)||'[]');setRecent(Array.isArray(items)?items.filter((x):x is Recent=>x&&typeof x.slug==='string'&&Number.isSafeInteger(x.chapter)&&x.chapter>0&&Number.isFinite(x.at)).sort((a,b)=>b.at-a.at):[]);}catch{setRecent([]);}
   setReady(true);
  };refresh();window.addEventListener('storage',refresh);window.addEventListener('panelverse:library-updated',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('panelverse:library-updated',refresh);};
 },[]);
 const bySlug=useMemo(()=>new Map(series.map(s=>[s.slug,s])),[series]);
 const savedStories=useMemo(()=>saved.map(slug=>bySlug.get(slug)).filter((s):s is Series=>Boolean(s)),[saved,bySlug]);
 const recentStories=useMemo(()=>recent.map(r=>({story:bySlug.get(r.slug),...r})).filter((r):r is Recent&{story:Series}=>Boolean(r.story)),[recent,bySlug]);
 function clearHistory(){try{localStorage.removeItem(recentKey);localStorage.removeItem('panelverse:last-read:v1');for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('panelverse:reading-position:v1:'))localStorage.removeItem(key);}setRecent([]);window.dispatchEvent(new Event('panelverse:library-updated'));}catch{}}
 const selected=tab==='saved'?savedStories.length:recentStories.length;
 return <section className="pv-library container">
   <div className="pv-library-hero"><span className="section-kicker">YOUR PERSONAL READING SPACE</span><h1>Your stories, <em>your shelf.</em></h1><p>Keep a little corner of Panelverse for the worlds you love. Saved titles and reading history stay in this browser—no account needed.</p><div className="pv-library-stats"><span><Bookmark size={17}/> {ready?savedStories.length:'—'} saved stories</span><span><Clock3 size={17}/> {ready?recentStories.length:'—'} recently read</span></div></div>
   <div className="pv-library-toolbar"><div className="pv-library-tabs" role="tablist" aria-label="Library sections"><button role="tab" aria-selected={tab==='continue'} className={tab==='continue'?'active':''} onClick={()=>setTab('continue')}><BookOpen size={17}/> Continue reading</button><button role="tab" aria-selected={tab==='saved'} className={tab==='saved'?'active':''} onClick={()=>setTab('saved')}><Bookmark size={17}/> Saved stories</button></div>{tab==='continue'&&recentStories.length>0&&<button className="pv-clear" onClick={clearHistory}><Trash2 size={15}/> Clear history</button>}</div>
   {!ready?<div className="pv-library-empty">Loading your local library…</div>:!selected?<div className="pv-library-empty"><div className="pv-empty-symbol">✦</div><h2>{tab==='saved'?'Start your collection':'Your next chapter starts here'}</h2><p>{tab==='saved'?'Visit any story and select “Save to library”.':'Open a chapter to see it here next time.'}</p><Link className="btn btn-primary" href="/browse"><Compass size={17}/> Discover stories</Link></div>:
    <div className="pv-library-grid">{tab==='saved'?savedStories.map(story=><div className="pv-library-card" key={story.slug}><Link href={`/series/${story.slug}`} className="pv-library-cover"><img src={story.cover||'/covers/placeholder.svg'} alt={story.title+' cover'} loading="lazy"/></Link><div className="pv-library-card-info"><span>{story.genres.split(',').slice(0,2).join(' / ')}</span><Link href={`/series/${story.slug}`}><h3>{story.title}</h3></Link><p>{story.subtitle}</p><div className="pv-library-card-actions"><SaveSeriesButton slug={story.slug} compact/>{story.latest_chapter?<Link href={`/read/${story.slug}/${story.latest_chapter}`} className="pv-library-read">Read <ArrowUpRight size={16}/></Link>:null}</div></div></div>):
    recentStories.map(({story,chapter})=><div className="pv-library-card" key={story.slug}><Link href={`/series/${story.slug}`} className="pv-library-cover"><img src={story.cover||'/covers/placeholder.svg'} alt={story.title+' cover'} loading="lazy"/></Link><div className="pv-library-card-info"><span>CONTINUE YOUR JOURNEY</span><Link href={`/series/${story.slug}`}><h3>{story.title}</h3></Link><p>Chapter {chapter}{story.latest_chapter&&story.latest_chapter>chapter?` · ${story.latest_chapter} chapters available`:''}</p><div className="pv-library-card-actions"><SaveSeriesButton slug={story.slug} compact/><Link href={`/read/${story.slug}/${chapter}`} className="pv-library-read">Continue <ArrowUpRight size={16}/></Link></div></div></div>)}</div>}
  </section>;
}
