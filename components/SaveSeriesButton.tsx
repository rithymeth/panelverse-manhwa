'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bookmark,BookmarkCheck} from 'lucide-react';
const key='panelverse:saved-series';
export default function SaveSeriesButton({slug,compact=false}:{slug:string;compact?:boolean}){
  const [saved,setSaved]=useState(false);
  const refresh=useCallback(()=>{try{const list=JSON.parse(localStorage.getItem(key)||'[]');setSaved(Array.isArray(list)&&list.includes(slug));}catch{setSaved(false);}},[slug]);
  useEffect(()=>{refresh();const update=()=>refresh();window.addEventListener('storage',update);window.addEventListener('panelverse:library-updated',update);return()=>{window.removeEventListener('storage',update);window.removeEventListener('panelverse:library-updated',update);};},[refresh]);
  const toggle=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');const current:string[]=Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];const updated=current.includes(slug)?current.filter(s=>s!==slug):[...current,slug];localStorage.setItem(key,JSON.stringify(updated.slice(-200)));setSaved(updated.includes(slug));window.dispatchEvent(new Event('panelverse:library-updated'));}catch{}};
  return <button type="button" className={compact?'pv-save pv-save-compact':'pv-save'} aria-pressed={saved} aria-label={saved?'Remove from my library':'Save to my library'} onClick={toggle}>{saved?<BookmarkCheck size={18}/>:<Bookmark size={18}/>}<span>{compact?(saved?'Saved':'Save'):(saved?'Saved to library':'Save to library')}</span></button>;
}
