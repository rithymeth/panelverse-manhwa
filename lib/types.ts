export type Series = { id: string; slug: string; title: string; subtitle: string; description: string; cover: string; genres: string; status: string; author: string; artist: string; year: number; featured: number; views: number; created_at: string; updated_at: string; chapter_count?: number; latest_chapter?: number | null; };
export type Chapter = { id: string; series_id: string; number: number; title: string; status: 'draft' | 'published'; created_at: string; published_at: string | null; pages_count?: number; };
export type Page = { id: string; chapter_id: string; position: number; image: string; width: number; height: number; created_at: string; };
export const genres = ['Action','Adventure','Fantasy','Romance','Comedy','Drama','Mystery','Sci-Fi','Slice of Life','Cultivation','Isekai','Academy'];
export const safeSlug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
export const formatViews = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}m` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
