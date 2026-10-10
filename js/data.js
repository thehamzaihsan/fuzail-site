// ─────────────────────────────────────────────────────────────
//  Portfolio content is stored in content/content.json and is
//  edited through the admin dashboard (admin/ → Start Admin.bat).
// ─────────────────────────────────────────────────────────────

const url = new URL('../content/content.json', import.meta.url);
export const CONTENT = await fetch(url, { cache: 'no-cache' }).then((r) => r.json());

const visible = (list) => (list || []).filter((x) => x && !x.hidden);

export const ARTIST = CONTENT.artist;
export const MODELS = CONTENT.models;
export const SHOWROOM = (CONTENT.showroom || []).filter((k) => MODELS[k] && !MODELS[k].hidden);
export const FEATURED = visible(CONTENT.featured);
export const FURNITURE = visible(CONTENT.furniture).filter((f) => MODELS[f.model]);
export const ENVIRONMENTS = visible(CONTENT.environments);
export const COMPARE = CONTENT.compare;
export const ARCHVIZ = { ...CONTENT.archviz, items: visible(CONTENT.archviz?.items) };
export const MORE = visible(CONTENT.more);
export const REEL = visible(CONTENT.reel);
export const TOOLKIT = CONTENT.toolkit || [];
export const MARQUEE = CONTENT.marquee || [];
export const HIGHLIGHTS = CONTENT.highlights || [];

// resolve a site-relative asset path so modules work from any page (site or admin preview)
export const asset = (p) => new URL('../' + p, import.meta.url).href;
