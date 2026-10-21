import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Series, Chapter, Page } from './types';
// Vercel functions can only write to /tmp; this is an ephemeral demo catalog,
// NOT durable publishing storage. Self-hosted deployments should set DATA_DIR to a persistent volume.
const dir = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/panelverse' : './data'));
let instance: Database.Database | null = null;
export function dataDir() { return dir; }
function initialize(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '', genres TEXT NOT NULL DEFAULT 'Fantasy', status TEXT NOT NULL DEFAULT 'Ongoing', author TEXT NOT NULL DEFAULT '', artist TEXT NOT NULL DEFAULT '', year INTEGER NOT NULL DEFAULT 2026, featured INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE, number INTEGER NOT NULL, title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT, UNIQUE(series_id, number));
    CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, position INTEGER NOT NULL, image TEXT NOT NULL, width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chapter_id, position));
    CREATE INDEX IF NOT EXISTS chapters_by_series ON chapters(series_id,number DESC);
    CREATE INDEX IF NOT EXISTS pages_by_chapter ON pages(chapter_id,position);
  `);
  if (process.env.SEED_DEMO !== 'false' && (db.prepare('SELECT COUNT(*) as n FROM series').get() as {n:number}).n === 0) {
    const insert = db.prepare('INSERT INTO series (id,slug,title,subtitle,description,cover,genres,status,author,artist,year,featured,views) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const items = [
      ['s1','the-whispering-tower','The Whispering Tower','Some secrets were never meant to stay sealed.','Rithy is an ordinary academy student—until a mysterious sigil leads him and Lina into a forbidden tower and a secret that could unravel their entire world. A magical academy adventure full of mystery, friendship, and relic magic.','/covers/whispering-tower.webp','Fantasy,Academy,Adventure,Mystery','Ongoing','Panelverse Studio','Panelverse Studio',2026,1,0],
      ['s2','the-mechanical-immortal','The Mechanical Immortal','A little engineering. A lot of immortality.','A displaced engineer enters a cultivation world and decides that the Dao needs an upgrade. Ancient traditions meet futuristic machinery.','/covers/mechanical-immortal.svg','Cultivation,Fantasy,Isekai','Ongoing','Panelverse Originals','Panelverse Studio',2026,1,0],
      ['s3','orbit-breaker','Orbit Breaker','One pilot. A thousand impossible choices.','When the frontier goes dark, a rookie ace receives a distress call from the edge of known space.','/covers/orbit-breaker.svg','Sci-Fi,Action,Adventure','Ongoing','Panelverse Originals','Panelverse Studio',2026,0,0],
      ['s4','flowers-for-an-immortal','Flowers for an Immortal','A quiet life beyond the clouds.','All Lin Yuan wants is tea, peaches, and a peaceful mountain cottage. Being the only cultivator in the world complicates things.','/covers/flowers-immortal.svg','Slice of Life,Cultivation,Comedy','Ongoing','Panelverse Originals','Panelverse Studio',2026,0,0],
      ['s5','midnight-contract','Midnight Contract','Love is written between worlds.','A midnight pact binds an apprentice witch to the guardian of a forgotten city.','/covers/midnight-contract.svg','Romance,Fantasy,Drama','Ongoing','Panelverse Originals','Panelverse Studio',2026,0,0],
      ['s6','the-last-admiral','The Last Admiral','The stars are not ready.','At the rim of a dying galaxy, a young commander inherits a fleet no one remembers.','/covers/last-admiral.svg','Sci-Fi,Action,Adventure','Ongoing','Panelverse Originals','Panelverse Studio',2026,0,0],
    ] as const;
    const seed = db.transaction(() => {
      for (const a of items) insert.run(...a);
      db.prepare('INSERT INTO chapters (id,series_id,number,title,status,published_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)').run('c1','s1',1,'The Whispering Tower','published');
      const addPage = db.prepare('INSERT INTO pages (id,chapter_id,position,image,width,height) VALUES (?,?,?,?,?,?)');
      for (let i=1;i<=5;i++) addPage.run(`p${i}`,'c1',i,`/demo/whispering-tower-${i}.webp`,941,1672);
    });
    seed();
  }
}
export function getDb() { if(!instance){ fs.mkdirSync(dir,{recursive:true}); instance = new Database(path.join(dir,'panelverse.sqlite')); initialize(instance); } return instance; }
export function allSeries(publishedOnly=true) {
  const sql = `SELECT s.*, (SELECT COUNT(*) FROM chapters c WHERE c.series_id=s.id AND ${publishedOnly?"c.status='published'":"1=1"}) as chapter_count, (SELECT MAX(number) FROM chapters c WHERE c.series_id=s.id AND c.status='published') as latest_chapter FROM series s ORDER BY s.featured DESC, s.views DESC`;
  return getDb().prepare(sql).all() as Series[];
}
export function getSeries(slug:string){ return getDb().prepare('SELECT * FROM series WHERE slug=?').get(slug) as Series|undefined; }
export function getSeriesId(id:string){ return getDb().prepare('SELECT * FROM series WHERE id=?').get(id) as Series|undefined; }
export function chaptersFor(seriesId:string, all=false){ return getDb().prepare(`SELECT c.*,(SELECT COUNT(*) FROM pages p WHERE p.chapter_id=c.id) as pages_count FROM chapters c WHERE c.series_id=? ${all?'':"AND c.status='published'"} ORDER BY c.number DESC`).all(seriesId) as Chapter[]; }
export function getChapter(seriesId:string,number:number,all=false){ return getDb().prepare(`SELECT * FROM chapters WHERE series_id=? AND number=? ${all?'':"AND status='published'"}`).get(seriesId,number) as Chapter|undefined; }
export function pagesFor(chapterId:string){return getDb().prepare('SELECT * FROM pages WHERE chapter_id=? ORDER BY position ASC').all(chapterId) as Page[];}
