/**
 * bus 176 P2: the cabinet theme, chosen by the user — «Светлая», «Тёмная» or «Как в системе» (the default) — plus
 * «Высокий контраст» (bus 84/97, AAA tokens). Both choices live in first-party cookies (one year, Path=/, SameSite=Lax),
 * not in localStorage, so the server renders the Family OS shell in the chosen theme (data-theme on the shell) and the
 * boot script in <head> sets the root classes before the first paint. An older choice kept in localStorage is copied
 * into the cookie once. The cookies carry only one of the words below: no id, nothing personal.
 */
export const THEME_COOKIE = "kartel-theme";
export const CONTRAST_COOKIE = "kartel-contrast";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;
/** The page colour behind the browser UI (meta theme-color): the cream-white light page and the heraldic dark one. */
export const THEME_COLOR = { light: "#ffffff", dark: "#0a0908" };

/** @param {unknown} v @returns {"light" | "dark" | "system"} */
export function parseTheme(v) {
  return v === "light" || v === "dark" ? v : "system";
}

/** @param {unknown} v @returns {"high" | "normal" | null} null: no choice stored, follow the OS `prefers-contrast`. */
export function parseContrast(v) {
  return v === "high" || v === "normal" ? v : null;
}

/** The Set-Cookie value written by the browser (document.cookie). Secure on https. */
export function themeCookie(name, value, secure) {
  return `${name}=${value}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * The inline script in <head> of every page that has the cabinet stylesheet: reads both cookies (copying a legacy
 * localStorage choice into them once), then sets .hc and .dark on <html> and the theme-color, before the first paint.
 * `withThemeColor`: false on pages that pin their own theme-color (the dark crest 404).
 */
export function themeBootScript(withThemeColor = true) {
  const meta = withThemeColor
    ? `var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'${THEME_COLOR.dark}':'${THEME_COLOR.light}');`
    : "";
  return `(function(){try{var g=function(n){var x=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return x?x[1]:null},`
    + `s=function(n,v){document.cookie=n+'='+v+'; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')},`
    + `t=g('${THEME_COOKIE}'),c=g('${CONTRAST_COOKIE}');`
    + `if(t===null){t=localStorage.getItem('${THEME_COOKIE}');if(t==='light'||t==='dark'||t==='system')s('${THEME_COOKIE}',t)}`
    + `if(c===null){c=localStorage.getItem('${CONTRAST_COOKIE}');if(c==='high'||c==='normal')s('${CONTRAST_COOKIE}',c)}`
    + `var r=document.documentElement;if(c==='high'||(c!=='normal'&&matchMedia('(prefers-contrast: more)').matches))r.classList.add('hc');`
    + `var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)r.classList.add('dark');`
    + `${meta}}catch(e){}})()`;
}
