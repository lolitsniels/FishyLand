// Post-build pre-render: writes static HTML (full text in the markup) for the public wiki, legal pages and guides.
// The production host resolves /wiki -> wiki.html, so crawlers get server-side content while the React app still
// boots on top of it. Never fails the build: any problem is logged and the plain SPA build is kept.
const { build } = require("esbuild");
const { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const root = resolve(__dirname, "..");
require("dotenv").config({ path: resolve(root, ".env") });
const BUILD = resolve(root, "build");
const SNAPSHOT = resolve(root, "scripts/wiki-snapshot.json");
const SITE = "https://thefishinglands.com";
const SOURCES = [...new Set([(process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, ""), SITE].filter(Boolean))];
const BACKEND = SOURCES[0];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function fetchFrom(base) {
  const get = async (p) => { const r = await fetch(base + p, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json(); };
  const [wiki, data] = await Promise.all([get("/api/wiki"), get("/api/game/data?lang=en")]);
  return { wiki, data };
}

async function fetchWikiState() {
  for (const base of SOURCES) {
    try {
      const state = await fetchFrom(base);
      try { writeFileSync(SNAPSHOT, JSON.stringify(state)); } catch {}
      return state;
    } catch (e) { console.warn(`[prerender] wiki data from ${base} unavailable (${e.message})`); }
  }
  console.warn("[prerender] using the saved wiki snapshot");
  return existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, "utf8")) : null;
}

function installDomShims() {
  const noop = () => {};
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.navigator = globalThis.navigator || { language: "en", languages: ["en"], userAgent: "prerender" };
  globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null, appendChild: noop, insertBefore: noop, removeChild: noop, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], firstChild: null, childNodes: [] });
  globalThis.document = { ...el(), hidden: false, referrer: "", documentElement: { ...el(), lang: "en" }, head: el(), body: el(), getElementById: () => null, createElement: el, createTextNode: () => ({}), createEvent: () => ({ initEvent: noop }) };
  globalThis.addEventListener = globalThis.addEventListener || noop;
  globalThis.removeEventListener = globalThis.removeEventListener || noop;
  globalThis.location = { pathname: "/", href: SITE + "/", search: "", hostname: "thefishinglands.com" };
  globalThis.__leaving = false;
}

function pageHtml(template, path, { title, description, body, state }) {
  const fullTitle = `${title} | The Fishing Lands`;
  const url = SITE + path;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace("</head>", `<link rel="canonical" href="${url}"/></head>`);
  const data = state ? `<script id="__WIKI_DATA__" type="application/json">${JSON.stringify(state).replace(/</g, "\\u003c")}</script>` : "";
  return html.replace(/<div id="root">[\s\S]*<\/div>(\s*<\/body>)/, (_, end) => `${data}<div id="root">${body}</div>${end}`);
}

async function main() {
  const templatePath = resolve(BUILD, "index.html");
  if (!existsSync(templatePath)) throw new Error("build/index.html not found — run `craco build` first");
  const template = readFileSync(templatePath, "utf8");
  const outfile = resolve(BUILD, ".prerender/entry.cjs");
  await build({
    entryPoints: [resolve(root, "scripts/prerender-entry.js")],
    bundle: true, platform: "node", format: "cjs", outfile, jsx: "automatic", logLevel: "silent", target: "node18",
    loader: { ".js": "jsx", ".css": "empty", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    define: { "process.env.NODE_ENV": '"production"', "process.env.REACT_APP_BACKEND_URL": JSON.stringify(BACKEND) },
    plugins: [{
      name: "i18n-shim",
      setup(b) { b.onResolve({ filter: /(^|\/)i18n$/ }, (a) => (a.path.startsWith(".") || a.path.startsWith("@/") ? { path: resolve(root, "scripts/i18n-shim.js") } : undefined)); },
    }],
  });
  installDomShims();
  const { render, ROUTES } = require(outfile);
  const wikiState = await fetchWikiState();
  let n = 0;
  for (const [path, meta] of Object.entries(ROUTES)) {
    const state = path === "/wiki" ? wikiState : null;
    if (path === "/wiki" && !state) { console.warn("[prerender] skipping /wiki: no data"); continue; }
    let body;
    try { body = render(path, state); } catch (e) { console.warn(`[prerender] skipping ${path}: ${e.message}`); continue; }
    const html = pageHtml(template, path, { title: meta.title, description: meta.description, body, state });
    const rel = path.replace(/^\//, "");
    const targets = [resolve(BUILD, `${rel}.html`), resolve(BUILD, rel, "index.html")];
    for (const t of targets) { mkdirSync(dirname(t), { recursive: true }); writeFileSync(t, html); }
    n++;
    console.log(`[prerender] ${path} -> ${rel}.html (${(html.length / 1024).toFixed(0)} KB)`);
  }
  rmSync(dirname(outfile), { recursive: true, force: true });
  console.log(`[prerender] done: ${n} pages`);
}

main().catch((e) => { console.warn(`[prerender] skipped: ${e.stack || e}`); rmSync(resolve(BUILD, ".prerender"), { recursive: true, force: true }); });
