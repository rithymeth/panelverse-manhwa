import type {Metadata} from 'next';
import CoworkerStudio from '@/components/CoworkerStudio';
import './coworker.css';
export const metadata:Metadata={title:'Manhwa Artist Coworker Studio',description:'Plan full-color webtoon chapters, keep character references consistent, review artwork, and publish directly to Panelverse.',robots:{index:false,follow:true}};
export default function CoworkerPage(){return <CoworkerStudio/>;}
