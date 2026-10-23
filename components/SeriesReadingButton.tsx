'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Play,BookmarkCheck} from 'lucide-react';

export default function SeriesReadingButton({slug,firstChapter,chaptersCsv}:{slug:string;firstChapter:number;chaptersCsv:string}){
 const [resume,setResume]=useState<number|null>(null);
 useEffect(()=>{
  const refresh=()=>{
   try{
    const raw=JSON.parse(localStorage.getItem('panelverse:recent-series')||'[]');
    const match=Array.isArray(raw)?raw.find(entry=>entry&&entry.slug===slug&&Number.isSafeInteger(entry.chapter)):null;
    if(match&&chaptersCsv.split(',').includes(String(match.chapter)))setResume(match.chapter);
    else setResume(null);
   }catch{setResume(null);}
  };
  refresh();
  window.addEventListener('pageshow',refresh);
  window.addEventListener('storage',refresh);
  window.addEventListener('panelverse:library-updated',refresh);
  return()=>{window.removeEventListener('pageshow',refresh);window.removeEventListener('storage',refresh);window.removeEventListener('panelverse:library-updated',refresh);};
 },[slug,chaptersCsv]);
 const number=resume??firstChapter;
 return <Link className="btn btn-primary btn-lg" href={'/read/'+slug+'/'+number}>{resume!==null?<BookmarkCheck size={16}/>:<Play size={15} fill="currentColor"/>}{resume!==null?'Continue Chapter '+resume:'Start Reading'}</Link>;
}
