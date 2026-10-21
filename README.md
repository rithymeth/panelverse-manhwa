# Panelverse — a full-stack manhwa reader & publishing studio

A responsive, full-color webtoon/manhwa platform built with **Next.js 15 App Router**, **React 19**, **TypeScript**, **SQLite**, and persistent local image storage.

The project includes an illustrated, 30-panel demonstration chapter (`The Whispering Tower`), organized as five sequential images, plus editable placeholder catalog series. The image assets are original example artwork from the owner's manhwa creation workflow.

## Features

- **Discovery site:** cinematic homepage, featured stories, genre browsing, live search, responsive story cards.
- **Story detail pages:** each series has its own `/series/[slug]` page, cover, synopsis, genres, author, and chapter list.
- **Vertical webtoon reader:** `/read/[slug]/[chapter]`, seamless scroll, chapter picker, keyboard shortcuts, reading-progress indicator, remembered chapter on the current browser.
- **Creator Studio:** private `/admin` dashboard for creating series, uploading covers, creating chapters, uploading multiple PNG/JPEG/WebP/GIF pages at once, reordering images, removing pages, and publishing/unpublishing chapters.
- **Durable content:** SQLite database and uploaded images under a configurable `DATA_DIR` directory; official Docker Compose volume configuration included.
- **Protected administration:** admin password, signed HTTP-only session cookie (24h), same-site cookie policy, origin validation on writes, and a basic login rate limit.
- **SEO:** metadata, sitemap, robot exclusions for admin routes.

## Quick start

Requires Node.js 22.13+ and npm.

```bash
npm install
cp .env.example .env.local
# Edit .env.local to set a secure ADMIN_PASSWORD and SESSION_SECRET
npm run dev
```

Open **http://localhost:3000** for the website and **http://localhost:3000/admin/login** to sign into the publishing studio.

To generate strong secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy one output into `ADMIN_PASSWORD` and generate another independent value for `SESSION_SECRET`.

### Publish a manhwa chapter

1. Sign in to Creator Studio.
2. Click **New series**, enter the title, description and genres.
3. Upload a cover image (portrait artwork works best).
4. Create Chapter 1.
5. Upload sequential chapter images (files named `01.png`, `02.png`, etc.). Up to 40 files per batch, 12MB per file and 70MB per batch. Each new batch appends after the previous one.
6. Drag-and-drop ordering is planned for a later release; use the up/down arrows to reorder images today.
7. Preview and click **Publish chapter**. Unpublished chapters are hidden from the public reader.

Public URL format: `/series/your-story` and `/read/your-story/1`.

## Docker + persistent storage

```bash
cp .env.example .env
# Configure ADMIN_PASSWORD and SESSION_SECRET
# Optional: change NEXT_PUBLIC_SITE_URL to your eventual domain
# Ensure an HTTPs reverse proxy terminates TLS for production.
docker compose up --build -d
```

`docker-compose.yml` mounts a named persistent Docker volume to `/app/data`. **Back up this volume regularly.** All user-uploaded covers and chapters are written to that volume, alongside `panelverse.sqlite`. Do not deploy the SQLite/local-file configuration to Vercel's ephemeral filesystem; replace the storage layer with hosted PostgreSQL/object storage first, or deploy to a server with persistent volumes.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Required: secure single-admin password, minimum 12 characters |
| `SESSION_SECRET` | Required: random session-signing secret, minimum 32 characters |
| `DATA_DIR` | Writable persistent directory for SQLite and uploaded files (default `./data`) |
| `SEED_DEMO` | Seed sample stories on the very first launch (`true` by default). Set to `false` for a new empty catalog. |
| `NEXT_PUBLIC_SITE_URL` | Origin used in sitemap URLs |

## Production notes

This is a self-hosted MVP suitable for one owner/editor. Before a public multi-author launch, add database-backed user accounts/roles, distributed rate limiting, image optimization and moderation, automated backups, a CDN, and shared object storage. Admin uses one password (not multi-user accounts). Uploads are file signature checked but no virus scanning or transcoding is included. Uploaded files use opaque names; their URLs are publicly accessible to anyone holding the URL. The image reader uses native `<img>` for smooth sequential loading.

The sample read/view counters start at zero and are **not yet instrumented** with analytics. The site displays real content only for `The Whispering Tower`; other initial catalog covers are labeled samples with no chapters.

### Current release limitations

The source package was syntax-validated in the generation environment, but **a full `npm install` and Next.js production build could not run** there because the npm registry was unreachable. Run `npm install && npm run build` in a machine/CI with network access to complete integration testing. No GitHub repository or live website deployment is implied by the ZIP alone.

## Connect the Manhwa Artist Coworker plugin (planned)

The site's publishing UI works independently. For direct plugin-to-site publishing, add an authenticated service-to-service REST API with token scopes and a release ingestion endpoint. The current project does not ship a working plugin ingestion bridge, and plugin jobs must be uploaded from the dashboard until that integration is added.

## License / artwork

Source code is delivered for the project owner's use. Sample artwork is for this project's demonstration; confirm rights before redistributing or publishing to a public catalog.
