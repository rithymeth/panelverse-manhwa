import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'Panelverse — Stories Without Limits',template:'%s | Panelverse'},description:'Read stunning full-color manhwa and webtoons. Discover captivating fantasy, action, romance and sci-fi stories.',robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
