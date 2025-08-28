// src/components/VaultsPanel.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import SafeBoxIcon from './SafeBoxIcon';
import VaultIcon from './VaultIcon';
import { useAuth } from '../contexts/AuthContext';

const vaultsKey = (username) => `vaultedge:vaults:${username}`;

// Compact panel for listing/selecting vaults inside Dashboard
export default function VaultsPanel() {
  const { user } = useAuth();
  const { t } = useI18n();
  const username = user?.username;
  const [vaults, setVaults] = useState([]);
  const [selectedVaultId, setSelectedVaultId] = useState(null);

  const load = useCallback(() => {
    if (!username) return;
    try {
      const raw = localStorage.getItem(vaultsKey(username)) || '[]';
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.sort((a,b)=> (a.badge === 'parent' ? -1 : b.badge === 'parent' ? 1 : (a.name||'').localeCompare(b.name||'')));
        setVaults(list);
      } else setVaults([]);
      const pref = localStorage.getItem(`vaultedge:selectedVault:${username}`);
      setSelectedVaultId(pref || (list && list[0] ? list[0].id : null));
    } catch { setVaults([]); }
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('vaultedge:vaultsChanged', h);
    return () => window.removeEventListener('vaultedge:vaultsChanged', h);
  }, [load]);

  if (!username) return null;

  const selectVault = (id) => {
    setSelectedVaultId(id);
  try { localStorage.setItem(`vaultedge:selectedVault:${username}`, id); } catch { /* ignore persist error */ }
  try { window.dispatchEvent(new CustomEvent('vaultedge:selectedVaultChanged', { detail: { id } })); } catch { /* ignore dispatch error */ }
  };

  // Default vault logic removed (star no longer displayed)

  // Build safebox counts per vault id from localStorage assignments
  let counts = {};
  try {
    if (username) {
  // Safebox registry: we stored id meta at safeboxMeta:<user>:<id> but need mapping id->vault in safeboxVault:<user>:<id>
      // We'll scan localStorage keys (bounded; assumes modest size). Fallback to 0 if none.
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`safeboxVault:${username}:`)) {
          const assigned = localStorage.getItem(k) || 'default';
          if (assigned && assigned !== 'default') {
            counts[assigned] = (counts[assigned] || 0) + 1;
          }
        }
      });
    }
  } catch { /* ignore counting errors */ }

  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 bg-white border rounded p-4 h-fit md:max-h-[calc(100vh-3rem)] overflow-auto">
      <div className="flex items-center gap-2 mb-4">{/* header */}
        <VaultIcon size={20} variant="child" className="text-gray-700" />
  <h2 className="text-sm font-semibold">{t('vaults.panel.title')}</h2>
      </div>
      {vaults.length === 0 ? (
        <div className="text-xs text-gray-500">{t('vaults.panel.empty')}</div>
      ) : (
        <ul className="space-y-1">
          {vaults.map(v => {
            const name = ((v.name||'').length > 22 ? (v.name||'').slice(0,22) + '…' : v.name) || t('vaults.panel.unnamed');
            return (
              <li key={v.id}>
                <button
                  onClick={() => selectVault(v.id)}
                  className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 hover:bg-gray-50 ${selectedVaultId === v.id ? 'bg-gray-100 font-medium' : ''}`}
                >
                  <VaultIcon size={20} variant={v.badge === 'parent' ? 'root' : 'child'} className="text-gray-700 shrink-0" />
                  <span className="truncate flex-1" title={v.name}>{name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
                    <SafeBoxIcon size={14} className="opacity-70" />
                    <span className="tabular-nums leading-none text-[11px]">{counts[v.id] || 0}</span>
                  </span>
                  {/* star removed per request */}
                  {/* Removed root badge label per unified icon design */}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
