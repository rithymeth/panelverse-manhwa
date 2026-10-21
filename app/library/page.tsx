import type {Metadata} from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LibraryClient from '@/components/LibraryClient';
import {allSeries} from '@/lib/db';
import {syncPublishedManhwa} from '@/lib/auto-publish';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'My Library',description:'Return to your favorite manhwa and continue reading on Panelverse.',robots:{index:false,follow:true}};
export default async function LibraryPage(){await syncPublishedManhwa();return <><Navbar/><main><LibraryClient series={allSeries()}/></main><Footer/></>;}
