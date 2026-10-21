'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {BookOpenText,Search,ArrowUpRight,Library,Menu,X,WandSparkles} from 'lucide-react';

export default function Navbar(){
  const [open,setOpen]=useState(false);
  const router=useRouter();
  const pathname=usePathname();
  useEffect(()=>{setOpen(false);},[pathname]);
  useEffect(()=>{
    const mq=window.matchMedia('(max-width: 900px)');
    const onResize=()=>{if(!mq.matches)setOpen(false);};
    onResize();
    mq.addEventListener('change',onResize);
    return()=>mq.removeEventListener('change',onResize);
  },[]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();router.push('/browse');setOpen(false);
      }
      if(event.key==='Escape')setOpen(false);
    };
    document.addEventListener('keydown',handler);
    return()=>document.removeEventListener('keydown',handler);
  },[router]);
  return <header className="site-header">
    <div className="container header-inner">
      <Link href="/" className="brand" onClick={()=>setOpen(false)}>
        <span className="brand-mark"><BookOpenText size={22} strokeWidth={2.4}/></span>
        <span>PANEL<span className="brand-accent">VERSE</span><small>ORIGINAL STORIES</small></span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <Link href="/browse">Discover</Link>
        <Link href="/library"><Library size={16}/> My Library</Link>
        <Link href="/coworker"><WandSparkles size={16}/> Create Manhwa</Link>
      </nav>
      <div className="header-right">
        <Link href="/browse" className="search-link" aria-label="Search stories">
          <Search size={18}/><span>Search stories</span><kbd>⌘ K</kbd>
        </Link>
        <Link href="/coworker" className="admin-link pv-publish-link" title="Manhwa Artist Coworker Studio">
          <WandSparkles size={18}/><span>Coworker Studio</span><ArrowUpRight size={14}/>
        </Link>
        <button type="button" className="pv-mobile-toggle" aria-label={open?'Close navigation':'Open navigation'}
          aria-expanded={open} aria-controls="panelverse-mobile-nav"
          onClick={()=>setOpen(value=>!value)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
      </div>
    </div>
    {open&&<>
      <button className="pv-mobile-backdrop" type="button" aria-label="Close mobile menu" onClick={()=>setOpen(false)}/>
      <nav id="panelverse-mobile-nav" className="pv-mobile-menu" aria-label="Mobile navigation">
        <Link onClick={()=>setOpen(false)} href="/">Home</Link>
        <Link onClick={()=>setOpen(false)} href="/browse">Discover stories</Link>
        <Link onClick={()=>setOpen(false)} href="/library">My Library</Link>
        <Link onClick={()=>setOpen(false)} href="/coworker">Manhwa Coworker</Link>
        <Link onClick={()=>setOpen(false)} href="/import">Quick chapter import</Link>
        <Link onClick={()=>setOpen(false)} href="/admin">Creator Studio</Link>
      </nav>
    </>}
  </header>;
}
