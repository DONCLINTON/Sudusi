// Netlify Edge Function: server-renders article + category pages for Google,
// and serves a live sitemap.xml and RSS feed.  Paths: /article/*  /category/*  /sitemap.xml  /feed.xml
// Uses only the PUBLIC Supabase anon key (read-only). Nothing secret is in this file.

const SB = "https://lulijpkeslesdeyemada.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bGlqcGtlc2xlc2RleWVtYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM1MDMsImV4cCI6MjEwMDg5OTUwM30.ptWL1GF5DrshvF6VhwIs3HjRiA_qWgVlux3uk61Hi_A";
const SITE = "https://sudusi.netlify.app";
const SOURCE = "sudusi";

const CATEGORIES = ["Tech","Crypto","Forex","Markets","Science","Space","Politics","Business","World","Health","Climate","Sports","Culture","Africa","Uganda","Europe","Americas","Asia","Middle East","Economy","Stocks","Gold & Commodities","Banking","Real Estate","Startups","Personal Finance","Trading Education","AI","Cybersecurity","Mobile & Gadgets","Energy","Education","Jobs & Careers","Agriculture","Auto","Football","Entertainment","Travel","Opinion","Analysis","Uncategorised"];
const slugify = (t: string) => String(t || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const catFromSlug = (s: string) => CATEGORIES.find((c) => slugify(c) === s) || "";

const STATIC_PAGES: [string, string, string][] = [
  ["/", "daily", "1.0"], ["/xauusd-signals/", "hourly", "0.9"], ["/about/", "monthly", "0.4"], ["/contact/", "monthly", "0.4"],
  ["/editorial-policy/", "monthly", "0.4"], ["/privacy/", "monthly", "0.3"], ["/cookies/", "monthly", "0.3"], ["/terms/", "monthly", "0.3"],
  ["/disclaimer/", "monthly", "0.3"], ["/affiliate-disclosure/", "monthly", "0.3"], ["/advertise/", "monthly", "0.3"],
];

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const trunc = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

async function rest(path: string): Promise<any[] | null> {
  try {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

// Tries the full query first; falls back if optional columns (status/slug/categories) are not in the database yet.
async function firstOk(paths: string[]): Promise<any[] | null> {
  for (const p of paths) { const r = await rest(p); if (r !== null) return r; }
  return null;
}

function cats(a: any): string[] {
  const c = Array.isArray(a.categories) && a.categories.length ? a.categories : [a.category || "Uncategorised"];
  return c.map(String);
}
const aurl = (a: any) => `${SITE}/article/${encodeURIComponent(a.slug || a.id)}`;

/* ---------- HTML shell rewriting ---------- */
function setHead(html: string, o: { title: string; description: string; url: string; image: string; type: string; ld: string }): string {
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  const t = esc(o.title), d = esc(o.description), u = esc(o.url), i = esc(o.image);
  const block =
    `<title>${t}</title><meta name="description" content="${d}"><link rel="canonical" href="${u}">` +
    `<meta property="og:site_name" content="SUDUSI NEWS"><meta property="og:type" content="${o.type}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${u}"><meta property="og:image" content="${i}">` +
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${i}">` +
    o.ld;
  return html.replace("</head>", block + "</head>");
}
function injectBody(html: string, inner: string): string {
  return html.replace(/(<main[^>]*>)/i, `$1<div id="ssr-article" class="max-w-3xl mx-auto py-6">${inner}</div>`);
}
async function shell(ctx: any, status = 200): Promise<{ html: string; status: number; headers: Headers }> {
  const res = await ctx.rewrite("/");
  const html = await res.text();
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" });
  return { html, status, headers };
}

/* ---------- article ---------- */
async function article(ctx: any, key: string): Promise<Response> {
  const k = encodeURIComponent(key);
  const rows = await firstOk([
    `articles?select=*&source=eq.${SOURCE}&status=eq.published&or=(slug.eq.${k},id.eq.${k})&limit=1`,
    `articles?select=*&source=eq.${SOURCE}&or=(slug.eq.${k},id.eq.${k})&limit=1`,
    `articles?select=*&source=eq.${SOURCE}&id=eq.${k}&limit=1`,
  ]);
  const a = rows && rows[0];
  if (!a) {
    const s = await shell(ctx, 404);
    return new Response(setHead(s.html, { title: "Article not found | SUDUSI NEWS", description: "This article could not be found.", url: SITE + "/", image: SITE + "/assets/og.png", type: "website", ld: "" }).replace("</head>", '<meta name="robots" content="noindex"></head>'), { status: 404, headers: s.headers });
  }
  const s = await shell(ctx);
  const url = aurl(a);
  const c = cats(a);
  const desc = trunc(String(a.meta_description || a.excerpt || String(a.content || "").replace(/\s+/g, " ")).trim(), 160);
  const title = String(a.meta_title || a.title);
  const image = a.image || SITE + "/assets/og.png";
  const published = a.date, modified = a.updated_at || a.date;
  const ld = jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle", headline: trunc(String(a.title), 110), image: [image], datePublished: published, dateModified: modified,
        author: { "@type": "Person", name: a.author || "Community Writer" },
        publisher: { "@type": "Organization", name: "SUDUSI NEWS", logo: { "@type": "ImageObject", url: SITE + "/assets/logo.png" } },
        mainEntityOfPage: { "@type": "WebPage", "@id": url }, articleSection: c[0], keywords: Array.isArray(a.tags) ? a.tags.join(", ") : undefined,
        description: desc, inLanguage: "en",
      },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: c[0], item: `${SITE}/category/${slugify(c[0])}` },
        { "@type": "ListItem", position: 3, name: a.title, item: url } ] },
    ],
  });
  const paras = String(a.content || "").split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
  const inner =
    `<nav><a href="/">Home</a> / ${c.map((x) => `<a href="/category/${slugify(x)}">${esc(x)}</a>`).join(", ")}</nav>` +
    `<article><h1>${esc(a.title)}</h1><p><small>By ${esc(a.author || "Community Writer")} · <time datetime="${esc(published)}">${esc(String(published).slice(0, 10))}</time> · ${esc(a.read_time || "")}</small></p>` +
    (a.image ? `<img src="${esc(a.image)}" alt="${esc(a.image_alt || a.title)}" style="max-width:100%;height:auto">` : "") + paras +
    (Array.isArray(a.tags) && a.tags.length ? `<p>Tags: ${a.tags.map((t: string) => esc(t)).join(", ")}</p>` : "") + `</article>`;
  const html = injectBody(setHead(s.html, { title: title + " | SUDUSI NEWS", description: desc, url, image, type: "article", ld }), inner);
  return new Response(html, { status: 200, headers: s.headers });
}

/* ---------- category ---------- */
async function category(ctx: any, slug: string): Promise<Response> {
  const name = catFromSlug(slug);
  if (!name) {
    const s = await shell(ctx, 404);
    return new Response(setHead(s.html, { title: "Category not found | SUDUSI NEWS", description: "This category does not exist.", url: SITE + "/", image: SITE + "/assets/og.png", type: "website", ld: "" }).replace("</head>", '<meta name="robots" content="noindex"></head>'), { status: 404, headers: s.headers });
  }
  const q = encodeURIComponent(`(categories.cs.{"${name}"},category.eq."${name}")`);
  const e = encodeURIComponent(name);
  const base = "select=id,slug,title,excerpt,image,date,author,category,categories";
  const rows = (await firstOk([
    `articles?${base}&source=eq.${SOURCE}&status=eq.published&or=${q}&order=date.desc&limit=40`,
    `articles?${base}&source=eq.${SOURCE}&or=${q}&order=date.desc&limit=40`,
    `articles?select=id,title,excerpt,image,date,author,category&source=eq.${SOURCE}&category=eq.${e}&order=date.desc&limit=40`,
  ])) || [];
  const url = `${SITE}/category/${slug}`;
  const desc = `Latest ${name} news, analysis and updates from SUDUSI NEWS.`;
  const s = await shell(ctx);
  const ld = jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: `${name} News`, url, description: desc, isPartOf: { "@type": "WebSite", name: "SUDUSI NEWS", url: SITE + "/" } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name, item: url }] },
      { "@type": "ItemList", itemListElement: rows.map((a: any, i: number) => ({ "@type": "ListItem", position: i + 1, url: aurl(a), name: a.title })) },
    ],
  });
  const list = rows.map((a: any) => `<li><a href="/article/${encodeURIComponent(a.slug || a.id)}">${esc(a.title)}</a><br><small>${esc(trunc(String(a.excerpt || ""), 160))}</small></li>`).join("");
  const inner = `<h1>${esc(name)} News</h1><p>${esc(desc)}</p>${rows.length ? `<ul>${list}</ul>` : "<p>No stories in this category yet.</p>"}`;
  const html = injectBody(setHead(s.html, { title: `${name} News | SUDUSI NEWS`, description: desc, url, image: SITE + "/assets/og.png", type: "website", ld }), inner);
  // empty categories are valid pages but should not be indexed
  const out = rows.length ? html : html.replace("</head>", '<meta name="robots" content="noindex,follow"></head>');
  return new Response(out, { status: 200, headers: s.headers });
}

/* ---------- sitemap + feed ---------- */
async function allArticles(select: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const page = await firstOk([
      `articles?select=${select}&source=eq.${SOURCE}&status=eq.published&order=date.desc&limit=1000&offset=${from}`,
      `articles?select=${select}&source=eq.${SOURCE}&order=date.desc&limit=1000&offset=${from}`,
    ]);
    if (!page || !page.length) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}
async function sitemap(): Promise<Response> {
  let arts = await allArticles("id,slug,date,updated_at,image,category,categories");
  if (!arts.length) arts = await allArticles("id,date,image,category");
  const used = new Set<string>();
  arts.forEach((a) => cats(a).forEach((c) => used.add(c)));
  const day = (d: string) => String(d || "").slice(0, 10);
  const u: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const [p, f, pr] of STATIC_PAGES) u.push(`<url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`);
  for (const c of CATEGORIES) if (used.has(c)) u.push(`<url><loc>${SITE}/category/${slugify(c)}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  for (const a of arts) {
    const img = a.image && /^https?:\/\//.test(a.image) ? `<image:image><image:loc>${esc(a.image)}</image:loc></image:image>` : "";
    u.push(`<url><loc>${esc(aurl(a))}</loc><lastmod>${day(a.updated_at || a.date)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority>${img}</url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${u.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" } });
}
async function feed(): Promise<Response> {
  const rows = (await firstOk([
    `articles?select=id,slug,title,excerpt,date,author,category,categories&source=eq.${SOURCE}&status=eq.published&order=date.desc&limit=30`,
    `articles?select=id,title,excerpt,date,author,category&source=eq.${SOURCE}&order=date.desc&limit=30`,
  ])) || [];
  const items = rows.map((a: any) =>
    `<item><title>${esc(a.title)}</title><link>${esc(aurl(a))}</link><guid isPermaLink="true">${esc(aurl(a))}</guid><pubDate>${new Date(a.date).toUTCString()}</pubDate><dc:creator>${esc(a.author || "Community Writer")}</dc:creator>${cats(a).map((c) => `<category>${esc(c)}</category>`).join("")}<description>${esc(trunc(String(a.excerpt || ""), 300))}</description></item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>SUDUSI NEWS</title><link>${SITE}/</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>Stocks, finance, forex, crypto, technology and global news.</description><language>en</language>\n${items}\n</channel></rss>\n`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=600" } });
}

export default async (req: Request, ctx: any): Promise<Response> => {
  const p = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  try {
    if (p === "/sitemap.xml") return await sitemap();
    if (p === "/feed.xml") return await feed();
    if (p.startsWith("/article/")) return await article(ctx, decodeURIComponent(p.slice(9)));
    if (p.startsWith("/category/")) return await category(ctx, decodeURIComponent(p.slice(10)));
  } catch (_) { /* fall through to the normal single-page app */ }
  return ctx.next();
};

export const config = { path: ["/article/*", "/category/*", "/sitemap.xml", "/feed.xml"] };
