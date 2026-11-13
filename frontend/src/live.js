import { createContext, useContext, useEffect, useRef } from 'react';

// ---------------------------------------------------------------- severities

/** Zabbix defaults; replaced by the names/colours configured in Zabbix after login. */
export const DEFAULT_SEVERITIES = [
  { value: 0, name: 'Not classified', color: '#97AAB3' },
  { value: 1, name: 'Information', color: '#7499FF' },
  { value: 2, name: 'Warning', color: '#FFC859' },
  { value: 3, name: 'Average', color: '#FFA059' },
  { value: 4, name: 'High', color: '#E97659' },
  { value: 5, name: 'Disaster', color: '#E45959' },
];

export const SeverityContext = createContext(DEFAULT_SEVERITIES);
export const useSeverities = () => useContext(SeverityContext);

/** Dark or white text, whichever reads better on the given background colour. */
export function textOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1f2937' : '#ffffff';
}

// ---------------------------------------------------------- tag suggestions

/** { tagName: [values...] } read from Zabbix; refreshed whenever an editor opens. */
export const TagSuggestionsContext = createContext({});
export const useTagSuggestions = () => useContext(TagSuggestionsContext);

// ------------------------------------------------------------- live refresh

/**
 * Calls `refresh` when the user comes back to the browser tab/window, so changes made in Zabbix
 * meanwhile (new items, triggers, tags, macros, hosts…) show up without reopening anything.
 * At most once every `minGapMs`.
 */
export function useRefreshOnFocus(refresh, minGapMs = 5000) {
  const last = useRef(Date.now());
  const fn = useRef(refresh);
  fn.current = refresh;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last.current < minGapMs) return;
      last.current = Date.now();
      fn.current();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [minGapMs]);
}

// ---------------------------------------------------------------- branding

/** { title, logoUrls: [..], primaryColor, accentColor } from the portal configuration. */
export const BrandContext = createContext({ title: 'Zabbix Self-Service Portal', logoUrls: [] });
export const useBrand = () => useContext(BrandContext);

/** Sets the browser tab title while the calling component is shown. */
export function usePageTitle(text) {
  const { title } = useBrand();
  useEffect(() => {
    if (!text) return undefined;
    const previous = document.title;
    document.title = `${text} – ${title}`;
    return () => { document.title = previous; };
  }, [text, title]);
}

// ---------------------------------------------------------- browser storage

export function loadLocal(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode etc.): ignore
  }
}
