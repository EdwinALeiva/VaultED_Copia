// src/components/Vaults.jsx (renamed from Companies.jsx)
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { storageApi } from '../services/storageApi';
import { toast } from 'react-hot-toast';
import SafeBoxIcon from './SafeBoxIcon';
import VaultIcon from './VaultIcon';
import SideMenu from './SideMenu';
import TopNav from './TopNav';
import CustomSelect from './CustomSelect';
import { ensureRegistryForNames } from '../services/safeboxRegistry';
import { useI18n } from '../contexts/I18nContext';

const vaultsKey = (username) => `vaultedge:vaults:${username}`;
const safeboxVaultKey = (username, safebox) => `safeboxVault:${username}:${safebox}`;

function safeParseArray(v) { try { if (typeof v !== 'string') return []; return JSON.parse(v); } catch { return []; } }

export default function Vaults() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const username = user?.username;
  const [vaults, setVaults] = useState([]);
  const [selectedVaultId, setSelectedVaultId] = useState(null);
  const [safeboxes, setSafeboxes] = useState([]);
  // No longer using a single selected set; we provide direct action buttons.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const raw = localStorage.getItem(vaultsKey(username)) || '[]';
      const list = safeParseArray(raw);
      setVaults(Array.isArray(list) ? list : []);
      await storageApi.ensureUser(username);
      const boxes = await storageApi.listSafeBoxes(username);
      const names = Array.isArray(boxes) ? boxes : [];
      const ids = ensureRegistryForNames(username, names || []);
      const mapped = (names || []).map((n, i) => ({ id: ids[i] || n, name: n }));
      setSafeboxes(mapped);
    } catch (e) {
      console.warn('Failed to load vaults or safeboxes', e);
      setVaults([]); setSafeboxes([]);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const boxesFor = useCallback((vaultId) => {
    if (!vaultId) return [];
    return safeboxes.filter(b => (localStorage.getItem(safeboxVaultKey(username, b.id)) || 'default') === vaultId);
  }, [safeboxes, username]);

  const createVault = () => {
  if (!username) return toast.error(t('vaults.toasts.signInFirst'));
    const name = (newName || '').trim();
    const email = (newEmail || '').trim();
  if (!name) return toast.error(t('vaults.toasts.enterName'));
  if (name.length > 20) return toast.error(t('vaults.toasts.nameTooLong'));
  if (!email || !email.includes('@')) return toast.error(t('vaults.toasts.invalidEmail'));
    const raw = localStorage.getItem(vaultsKey(username)) || '[]';
    const list = safeParseArray(raw);
    const id = `c_${Date.now()}`;
    const rootKey = `vaultedge:rootVault:${user.username}`;
    const parentId = localStorage.getItem(rootKey) || null;
    const nameToStore = name.length > 20 ? name.slice(0,20) : name;
    const next = [...list, { id, name: nameToStore, notifyEmail: email, createdAt: new Date().toISOString(), parentId }];
    localStorage.setItem(vaultsKey(username), JSON.stringify(next));
    setVaults(next);
    setCreating(false); setNewName(''); setNewEmail('');
    setSelectedVaultId(id);
    window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
  toast.success(t('vaults.toasts.created'));
  };

  // Association helpers
  const assignBox = (boxId) => {
    if (!username || !selectedVaultId) return;
    try {
      localStorage.setItem(safeboxVaultKey(username, boxId), selectedVaultId);
      window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
      load();
  } catch (e) { console.warn('assign failed', e); toast.error(t('vaults.toasts.failedAddBox')); }
  };
  const unassignBox = (boxId) => {
    if (!username) return;
    try {
      // Return to default/root by deleting the mapping (or setting default)
      localStorage.setItem(safeboxVaultKey(username, boxId), 'default');
      window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
      load();
  } catch (e) { console.warn('unassign failed', e); toast.error(t('vaults.toasts.failedRemoveBox')); }
  };
  const bulkAssignAll = (available) => {
    if (!username || !selectedVaultId) return;
    try {
      for (const b of available) localStorage.setItem(safeboxVaultKey(username, b.id), selectedVaultId);
      window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
      load();
  } catch (e) { console.warn('bulk assign failed', e); toast.error(t('vaults.toasts.failedAddBoxes')); }
  };
  const bulkUnassignAll = (associated) => {
    if (!username) return;
    try {
      for (const b of associated) localStorage.setItem(safeboxVaultKey(username, b.id), 'default');
      window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
      load();
  } catch (e) { console.warn('bulk unassign failed', e); toast.error(t('vaults.toasts.failedRemoveBoxes')); }
  };

  useEffect(() => {
    const h = (ev) => {
      const a = ev?.detail?.action;
      if (!a) return;
      if (a === 'create') setCreating(true);
      if (a === 'manage') { if (vaults && vaults.length) setSelectedVaultId(vaults[0].id); }
    };
    window.addEventListener('vaultedge:vaultsAction', h);
    return () => window.removeEventListener('vaultedge:vaultsAction', h);
  }, [vaults]);

  if (!username) return (<div className="p-6">{t('vaults.toasts.signInFirst')} <button className="ml-3 underline" onClick={() => navigate('/dashboard')}>{t('notFound.goDashboard')}</button></div>);

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} onLogout={logout} />
        <main className="p-6 overflow-auto flex gap-6">
          <aside className="w-96 bg-white border p-4 rounded flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <VaultIcon size={20} variant="child" className="text-gray-700" />
              <div className="text-sm font-semibold">{t('vaults.panel.title')}</div>
            </div>
            <div className="flex-1 overflow-auto">
              {vaults.length === 0 ? (
                <div className="text-sm text-gray-500">{t('vaults.list.empty')}</div>
              ) : (
                <div>
                  <div className="grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-2 pb-2 border-b">
                    <div className="col-span-6">{t('vaults.form.name')}</div>
                    <div className="col-span-4">{t('vaults.form.notificationEmail')}</div>
                    <div className="col-span-2 text-right">{t('vaults.boxes.plural')}</div>
                  </div>
                  <ul className="mt-2">
                    {vaults.map(v => (
                      <li key={v.id}>
                        <button className={`w-full text-left p-2 rounded hover:bg-gray-50 ${selectedVaultId === v.id ? 'bg-gray-100' : ''}`}
                          onClick={() => {
                            setSelectedVaultId(v.id);
                            try { if (username) localStorage.setItem(`vaultedge:selectedVault:${username}`, v.id); } catch (e) { console.warn('persist selectedVault failed', e); }
                            try { window.dispatchEvent(new CustomEvent('vaultedge:selectedVaultChanged', { detail: { id: v.id } })); } catch (e) { console.warn('dispatch selectedVaultChanged failed', e); }
                          }}
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-6 flex items-center gap-2">
                              <VaultIcon size={20} variant={v.badge === 'parent' ? 'root' : 'child'} className="text-gray-700" />
                              <div className="text-[13px] font-medium">{v.badge === 'parent' ? t('vaults.root') : ((v.name||'').length > 20 ? (v.name||'').slice(0,20) + '…' : v.name)}</div>
                            </div>
                            <div className="col-span-4 text-[11px] text-gray-500 truncate" title={v.notifyEmail}>{v.notifyEmail}</div>
                            <div className="col-span-2 flex items-center justify-end gap-1 text-gray-600">
                              <SafeBoxIcon size={14} className="opacity-70" />
                              <span className="tabular-nums text-[11px] leading-none">{boxesFor(v.id).length}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
          <section className="flex-1">
            <div className="ve-card p-4 max-w-3xl">
              {!selectedVaultId ? (
                <div className="text-gray-600">{t('vaults.prompt.manage')}</div>
              ) : (() => {
                const associated = boxesFor(selectedVaultId);
                // Available: any box not currently in this vault
                const available = safeboxes.filter(b => !associated.some(a => a.id === b.id));
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h2 className="text-base font-semibold mb-0.5">{(() => { const sel = vaults.find(x => x.id === selectedVaultId); if (!sel) return ''; if (sel.badge === 'parent') return t('vaults.root'); if (sel.parentId) return sel.name && sel.name.length > 28 ? sel.name.slice(0,28) + '…' : sel.name; return sel.name; })()}</h2>
                          <div className="text-[11px] text-gray-500 flex items-center gap-3">
                            <span>{vaults.find(x => x.id === selectedVaultId)?.notifyEmail}</span>
                            {vaults.find(x => x.id === selectedVaultId)?.badge === 'parent' && <span className="text-blue-600 font-medium">{t('vaults.root')}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{associated.length} {associated.length===1?t('vaults.boxes.singular'):t('vaults.boxes.plural')}</div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">{t('vaults.associated.title')}</h3>
                        {associated.length > 0 && <button onClick={() => bulkUnassignAll(associated)} className="text-[11px] text-red-600 hover:underline">{t('vaults.associated.removeAll')}</button>}
                      </div>
                      <div className="border rounded bg-white max-h-72 overflow-auto divide-y">
                        {associated.length === 0 ? <div className="p-3 text-sm text-gray-500">{t('vaults.associated.empty')}</div> : associated.map(b => (
                          <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-sm font-medium truncate" title={b.name}>{b.name}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => unassignBox(b.id)} className="text-[11px] px-2 py-1 border rounded hover:bg-red-50 text-red-600">{t('vaults.action.remove')}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">{t('vaults.available.title')}</h3>
                        {available.length > 0 && <button onClick={() => bulkAssignAll(available)} className="text-[11px] text-blue-600 hover:underline">{t('vaults.available.addAll')}</button>}
                      </div>
                      <div className="border rounded bg-white max-h-72 overflow-auto divide-y">
                        {available.length === 0 ? <div className="p-3 text-sm text-gray-500">{t('vaults.available.empty')}</div> : available.map(b => {
                          // show current vault if not default (move action)
                          const currentVaultId = (localStorage.getItem(safeboxVaultKey(username, b.id)) || 'default');
                          let badge = null;
                          if (currentVaultId !== 'default' && currentVaultId !== selectedVaultId) {
                            const cv = vaults.find(v => v.id === currentVaultId);
                            badge = cv ? (cv.badge === 'parent' ? 'Root' : (cv.name||'').slice(0,14)) : 'Other';
                          }
                          return (
                            <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                              <span className="text-sm font-medium truncate" title={b.name}>{b.name}</span>
                              <div className="flex items-center gap-2">
                                {badge && <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 border" title={t('vaults.badge.current')}>{badge}</span>}
                                <button onClick={() => assignBox(b.id)} className="text-[11px] px-2 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700">{t('vaults.action.add')}</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500">{t('vaults.move.hint')}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            {creating && (
              <div className="mt-4 ve-card p-4">
                <h3 className="text-lg font-semibold mb-3">{t('vaults.form.createTitle')}</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm">{t('vaults.form.name')}</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 block w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm">{t('vaults.form.notificationEmail')}</label>
                    <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 block w-full border rounded p-2" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createVault} className="px-3 py-1 bg-blue-600 text-white rounded">{t('vaults.form.create')}</button>
                    <button onClick={() => setCreating(false)} className="px-3 py-1 border rounded">{t('vaults.form.cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
