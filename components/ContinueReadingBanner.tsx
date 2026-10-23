'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BookOpen,ArrowRight,BookmarkCheck} from 'lucide-react';

type Story={slug:string;title:string;cover:string};
type Bookmark={slug:string;title:string;chapter:number;at:number};
type ReadingCheckpoint={ratio?:number;y?:number;updatedAt?:number};
export default function ContinueReadingBanner({stories}:{stories:Story[]}){
 const [bookmark,setBookmark]=useState<{story:Story;chapter:number;percent:number}|null>(null);
 useEffect(()=>{
  const refresh=()=>{
   try{
    const raw=localStorage.getItem('panelverse:last-read:v1');
    if(!raw){setBookmark(null);return;}
    const b=JSON.parse(raw) as Bookmark;
    if(!b||typeof b.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug)||!Number.isSafeInteger(b.chapter)||b.chapter<1){setBookmark(null);return;}
    const story=stories.find(s=>s.slug===b.slug);
    if(!story){setBookmark(null);return;}
    const rawCheckpoint=localStorage.getItem('panelverse:reading-position:v1:'+b.slug+':'+b.chapter);
    const checkpoint=rawCheckpoint?JSON.parse(rawCheckpoint) as ReadingCheckpoint:null;
    const ratio=typeof checkpoint?.ratio==='number'&&Number.isFinite(checkpoint.ratio)?checkpoint.ratio:0;
    setBookmark({story,chapter:b.chapter,percent:Math.max(0,Math.min(100,Math.round(ratio*100)))});
   }catch{setBookmark(null);}
  };
  refresh();
  window.addEventListener('storage',refresh);
  window.addEventListener('pageshow',refresh);
  window.addEventListener('panelverse:library-updated',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('pageshow',refresh);window.removeEventListener('panelverse:library-updated',refresh);};
 },[stories]);
 if(!bookmark)return null;
 return <section className="pv-continue-banner" aria-label="Continue reading">
  <div className="container pv-continue-inner">
   <div className="pv-continue-thumb"><img src={bookmark.story.cover} alt={bookmark.story.title+' cover'} loading="lazy"/></div>
   <div className="pv-continue-copy">
    <span><BookmarkCheck size={15}/> YOUR READING SPOT IS SAVED</span>
    <h2>Continue where you left off</h2>
    <p><strong>{bookmark.story.title}</strong> · Chapter {bookmark.chapter}{bookmark.percent>0?' · '+bookmark.percent+'% read':''}</p>
   </div>
   <Link href={'/read/'+bookmark.story.slug+'/'+bookmark.chapter} className="btn btn-primary pv-continue-button">
    <BookOpen size={17}/> Resume chapter <ArrowRight size={17}/>
   </Link>
  </div>
 </section>;
}
