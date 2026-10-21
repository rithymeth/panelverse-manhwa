import Link from 'next/link';
import {ArrowUpRight,Eye,BookOpen} from 'lucide-react';
import type {Series} from '@/lib/types';
import {formatViews} from '@/lib/types';
export default function StoryCard({story,index=0,compact=false}:{story:Series;index?:number;compact?:boolean}){
 const tags=story.genres.split(',');
 return <Link href={`/series/${story.slug}`} className={`story-card ${compact?'story-card-compact':''}`}><div className="story-art" style={{backgroundColor:['#283044','#2a3037','#182b38'][index%3]}}><img src={story.cover || '/covers/placeholder.svg'} alt={`${story.title} cover`} loading="lazy"/><div className="story-art-shine"/><span className="story-top-tag">{story.status==='Completed'?'COMPLETED':story.status==='Hiatus'?'ON BREAK':'ONGOING'}</span><span className="story-open"><ArrowUpRight size={20}/></span></div><div className="story-meta"><div className="story-genres">{tags.slice(0,2).join(' / ')}</div><h3>{story.title}</h3><p>{story.subtitle}</p><div className="story-stats"><span><Eye size={14}/>{formatViews(story.views)}</span><span><BookOpen size={14}/>{story.chapter_count||0} ch</span></div></div></Link>
}
