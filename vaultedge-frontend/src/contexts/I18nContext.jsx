import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Simple lightweight i18n context (can be swapped with i18next later).
// Loads catalog from backend /api/i18n/catalog?lang=xx and caches in localStorage.

const I18nContext = createContext(null);

const LS_PREFIX = 'vaultedge:i18n:';
const DEFAULT_LANG = 'en';
const FALLBACK_MESSAGES = {
  'app.title': 'VaultEdge',
  'login.title': 'VaultEdge Login',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.forgotPassword': 'Forgot Password?',
  'login.signIn': 'Sign In',
  'logout': 'Logout',
  'menu.globalActions': 'Global Actions',
  'menu.createSafebox': 'Create SafeBox',
  'menu.uploadFile': 'Upload File',
  'menu.settings': 'Settings',
  'menu.billing': 'Billing & Subscription',
  // Dashboard minimal fallbacks (English)
  'dashboard.title': 'Dashboard',
  'dashboard.search.placeholder': 'Search Safe-Deposit Boxes',
  'dashboard.boxes.title': 'Safe-Deposit Boxes',
  'dashboard.filter.sizeRange.title': 'Filtered by size range',
  'dashboard.filter.sizeRange.clear': 'Clear size filter',
  'dashboard.loading.list': 'Loading list…',
  'dashboard.loading.usage': 'Calculating usage…',
  'dashboard.empty.noMatches': 'No SafeBoxes match your search.',
  'dashboard.box.blockedWatermark': 'BLOCKED',
  'dashboard.box.label.created': 'Created:',
  'dashboard.box.label.type': 'Type:',
  'dashboard.box.label.securityAbbrev': 'Sec:',
  'dashboard.box.security.single': 'Single key security',
  'dashboard.box.security.dual': 'Dual key security',
  'dashboard.box.usage.aria': 'Usage {percent}%',
  'dashboard.box.usage.critical': 'Critical usage',
  'dashboard.box.usage.approaching': 'Approaching limit',
  'dashboard.box.selectAria': 'Select {name}',
  'dashboard.error.loadBoxes': 'Failed to load SafeBoxes',
  'dashboard.error.loadUsage': 'Failed to load usage',
  'dashboard.sort.fieldTitle': 'Sort field',
  'dashboard.sort.direction.desc': 'Descending',
  'dashboard.sort.direction.asc': 'Ascending',
  'dashboard.sort.toggleDirAria': 'Toggle direction',
  'dashboard.sort.createdAt': 'Recent',
  'dashboard.sort.capacity': 'Cap',
  'dashboard.sort.used': 'Used',
  'dashboard.sort.available': 'Free',
  'dashboard.sort.security': 'Sec',
  'dashboard.sort.type': 'Type',
  'dashboard.sort.name': 'Name',
  'dashboard.files.singular': 'file',
  'dashboard.files.plural': 'files'
  ,'safebox.type.personal': 'Personal'
  ,'safebox.type.business': 'Business'
};

export function I18nProvider({ children }) {
  const normalize = (l) => {
    if (!l) return DEFAULT_LANG;
    const lower = l.toLowerCase();
    switch (lower) {
      case 'eng': return 'en';
      case 'spa': return 'es';
      case 'fra': return 'fr';
      case 'por': return 'pt';
      case 'deu': return 'de';
      default: return lower;
    }
  };
  const [lang, setLang] = useState(() => {
    try { return normalize(localStorage.getItem(LS_PREFIX + 'current')) || DEFAULT_LANG; } catch { return DEFAULT_LANG; }
  });
  const [messages, setMessages] = useState(FALLBACK_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [languages, setLanguages] = useState([{ code: 'en', name: 'English' }, { code: 'es', name: 'Español' }]);

  const loadCatalog = useCallback(async (rawLang) => {
    const l = normalize(rawLang);
    setLoading(true); setError(null);
    try {
      // cache check
      const cacheKey = LS_PREFIX + 'catalog:' + l;
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        const loaded = parsed.messages || parsed;
        setMessages({ ...FALLBACK_MESSAGES, ...loaded });
      }
      const resp = await fetch(`/api/i18n/catalog?lang=${encodeURIComponent(l)}`, { headers: { 'Accept-Language': l } });
      if (!resp.ok) throw new Error('Failed to load translations');
  const data = await resp.json();
  const loaded = data.messages || {};
  setMessages({ ...FALLBACK_MESSAGES, ...loaded });
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore quota */ }
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCatalog(lang); }, [lang, loadCatalog]);

  // Load available languages (dynamic)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/i18n/languages');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length) setLanguages(data);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const t = useCallback((key, vars) => {
    let val = messages[key];
    if (val == null) return key; // show key to spot missing translation
    if (vars) {
      Object.entries(vars).forEach(([k,v]) => {
        val = val.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }
    return val;
  }, [messages]);

  const switchLanguage = (l) => {
    const n = normalize(l);
    setLang(n);
    try { localStorage.setItem(LS_PREFIX + 'current', n); } catch { /* ignore quota */ }
  };

  return (
  <I18nContext.Provider value={{ lang, messages, t, switchLanguage, loading, error, languages }}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
