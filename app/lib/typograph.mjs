/**
 * RU typographer for Family OS copy (QA-156 L8). Pure: it only turns some ordinary spaces into non-breaking
 * ones (U+00A0), so a line never ends on «в», «не», «до 21:00» splits nowhere, and «7 дней» stays together.
 * Nothing is added, removed or reordered — the text reads and copies the same.
 *
 * Rules, in order:
 *  1. after a short word — prepositions, conjunctions, particles and pronouns of 1–3 letters (SHORT);
 *  2. before a trailing particle (же, ли, бы, ль) — «что же», «так ли»;
 *  3. between a number and the word, unit or sign after it — «7 дней», «5 мин», «3 из 7», «18 +»;
 *  4. after «<», «>», «≤», «≥», «№», «§» and before a dash — «< 3 мес», «Документы — срок».
 * Applied to dictionary strings at module load (`typographDict`), never to what people type.
 */
const NBSP = " ";
// One- and two-letter words that must not end a line, plus the common three-letter prepositions.
const SHORT = [
  "а", "в", "и", "к", "о", "с", "у", "я",
  "во", "ко", "со", "об", "от", "до", "на", "по", "за", "из", "не", "ни", "но", "да", "их", "мы", "ты", "он", "мне", "им", "ей", "её", "ее", "же", "ли", "бы", "то", "уж", "ещё", "еще",
  "без", "для", "над", "под", "при", "про", "обо", "изо", "ото", "как", "так", "что", "или", "это", "все", "всё", "она", "оно", "они", "его",
];
const TRAILING = ["же", "ли", "бы", "ль"];
const L = "А-Яа-яЁёA-Za-z";
// Rule 1: the short word must start the string or follow a space, an opening quote/bracket or a dash.
const SHORT_RE = new RegExp(`(^|[\\s(«„"'\\u00a0—–-])(${SHORT.join("|")}) +(?=[${L}0-9«„"(<>№§+−-])`, "giu");
const TRAILING_RE = new RegExp(`([${L}0-9]) +(${TRAILING.join("|")})(?![${L}])`, "giu");
const NUMBER_RE = new RegExp(`(\\d) +(?=[${L}%°+×«])`, "gu");
const SIGN_RE = /([<>≤≥№§]) +(?=\d)/gu;
const DASH_RE = / +(?=[—–] )/gu;

/** @param {string} s @returns {string} */
export function typograph(s) {
  if (typeof s !== "string" || s.indexOf(" ") < 0) return s;
  let out = s;
  // Short words can follow each other («и в», «а не»): run until stable (at most a few passes).
  for (let i = 0; i < 4; i++) {
    const next = out.replace(SHORT_RE, (_, pre, w) => `${pre}${w}${NBSP}`);
    if (next === out) break;
    out = next;
  }
  return out.replace(TRAILING_RE, `$1${NBSP}$2`).replace(NUMBER_RE, `$1${NBSP}`).replace(SIGN_RE, `$1${NBSP}`).replace(DASH_RE, NBSP);
}

/**
 * The same dictionary with every string typographed; functions return typographed strings. Keys, arrays and
 * the object shape stay as they were, so `T.RU` keeps its type.
 * @template T
 * @param {T} dict
 * @returns {T}
 */
export function typographDict(dict) {
  /** @param {unknown} v @returns {unknown} */
  const walk = (v) => {
    if (typeof v === "string") return typograph(v);
    if (typeof v === "function") return (/** @type {unknown[]} */ ...a) => walk(v(...a));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return /** @type {T} */ (walk(dict));
}

/**
 * Content kept as `{ …EN, …RU }` field pairs («Наследие»: tree nodes, timeline events): every string under a key
 * ending in "RU" is typographed, at any depth; everything else is returned as it was (QA-158 N5).
 * @template T
 * @param {T} data
 * @returns {T}
 */
export function typographRuFields(data) {
  /** @param {unknown} v @param {boolean} ru @returns {unknown} */
  const walk = (v, ru) => {
    if (typeof v === "string") return ru ? typograph(v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, ru));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, ru || k.endsWith("RU"))]));
    return v;
  };
  return /** @type {T} */ (walk(data, false));
}

const cache = new WeakMap();
/**
 * `T[lang]` for a component dictionary `{ EN, RU }`, with the RU half typographed once per dictionary.
 * Components call `tx(T, lang)` where they used to read `T[lang]`; the source dictionaries stay as written.
 * @template {{ EN: unknown, RU: unknown }} D
 * @template {"EN" | "RU"} K
 * @param {D} dict
 * @param {K} lang
 * @returns {D[K]}
 */
export function tx(dict, lang) {
  if (lang !== "RU") return dict[lang];
  if (!cache.has(dict)) cache.set(dict, typographDict(dict.RU));
  return cache.get(dict);
}
