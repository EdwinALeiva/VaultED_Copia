// src/components/Companies.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { storageApi } from '../services/storageApi';
import { toast } from 'react-hot-toast';
// Unified icon style (reuse SafeBoxIcon for vaults & boxes for consistency)
import SafeBoxIcon from './SafeBoxIcon';
import VaultIcon from './VaultIcon';
import SideMenu from './SideMenu';
import TopNav from './TopNav';
import CustomSelect from './CustomSelect';
import { ensureRegistryForNames } from '../services/safeboxRegistry';

const vaultsKey = (username) => `vaultedge:vaults:${username}`;
const safeboxVaultKey = (username, safebox) => `safeboxVault:${username}:${safebox}`;

function safeParseArray(v) {
  try { if (typeof v !== 'string') return []; return JSON.parse(v); } catch { return []; }
}

export default function Companies() {
  // Include logout so TopNav hamburger menu can properly sign the user out
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const username = user?.username;

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [safeboxes, setSafeboxes] = useState([]);
  const [selectedBoxes, setSelectedBoxes] = useState(new Set());

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const load = useCallback(async () => {
    if (!username) return;
    try {
  const raw = localStorage.getItem(vaultsKey(username)) || '[]';
  const list = safeParseArray(raw);
  setCompanies(Array.isArray(list) ? list : []);

  await storageApi.ensureUser(username);
  const boxes = await storageApi.listSafeBoxes(username);
  // ensure registry has ids for the returned names and store as objects { id, name }
  const names = Array.isArray(boxes) ? boxes : [];
  const ids = ensureRegistryForNames(username, names || []);
  const mapped = (names || []).map((n, i) => ({ id: ids[i] || n, name: n }));
  setSafeboxes(mapped);
    } catch (e) {
      console.warn('Failed to load companies or safeboxes', e);
      setCompanies([]); setSafeboxes([]);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  // helper: get boxes assigned to a vault id
  const boxesFor = useCallback((companyId) => {
    if (!companyId) return [];
    return safeboxes.filter(b => (localStorage.getItem(safeboxVaultKey(username, b.id)) || 'default') === companyId);
  }, [safeboxes, username]);

  const createCompany = () => {
    if (!username) return toast.error('Sign in first');
    const name = (newName || '').trim();
    const email = (newEmail || '').trim();
  if (!name) return toast.error('Enter vault name');
  if (name.length > 20) return toast.error('Vault name must be 20 characters or fewer');
    if (!email || !email.includes('@')) return toast.error('Enter a valid email');
  const raw = localStorage.getItem(vaultsKey(username)) || '[]';
  const list = safeParseArray(raw);
  const id = `c_${Date.now()}`;
  // Attach to user's root company as parent if present
  const rootKey = `vaultedge:rootVault:${user.username}`;
  const parentId = localStorage.getItem(rootKey) || null;
  const nameToStore = name.length > 20 ? name.slice(0,20) : name;
  const next = [...list, { id, name: nameToStore, notifyEmail: email, createdAt: new Date().toISOString(), parentId }];
  localStorage.setItem(vaultsKey(username), JSON.stringify(next));
  setCompanies(next);
    setCreating(false); setNewName(''); setNewEmail('');
  setSelectedCompanyId(id);
  window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
  toast.success('Vault created');
  };

  const toggleSelectBox = (boxId) => {
    setSelectedBoxes(prev => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
      return next;
    });
  };

  const moveSelectedBoxesTo = (targetCompanyId) => {
    if (!username) return toast.error('Sign in first');
  if (!targetCompanyId) return toast.error('Choose a target vault');
    if (!selectedBoxes || selectedBoxes.size === 0) return toast.error('Select boxes to move');
    try {
      for (const bId of Array.from(selectedBoxes)) {
  localStorage.setItem(safeboxVaultKey(username, bId), targetCompanyId);
      }
      setSelectedBoxes(new Set());
  window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged'));
      load();
      toast.success('Boxes moved (local)');
    } catch (e) {
      console.warn(e);
      toast.error('Failed to move boxes');
    }
  };

  // react to sidebar actions (create / assign)
  useEffect(() => {
    const h = (ev) => {
      const a = ev?.detail?.action;
      if (!a) return;
      if (a === 'create') setCreating(true);
      if (a === 'manage') {
        if (companies && companies.length) setSelectedCompanyId(companies[0].id);
      }
      if (a === 'assign') {
        // nothing to open here; UI shows move when boxes selected
      }
    };
  window.addEventListener('vaultedge:vaultsAction', h);
  return () => window.removeEventListener('vaultedge:vaultsAction', h);
  }, [companies]);

  if (!username) return (
    <div className="p-6">Please sign in. <button className="ml-3 underline" onClick={() => navigate('/dashboard')}>Exit</button></div>
  );

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
  <TopNav user={user} onLogout={logout} />
        <main className="p-6 overflow-auto flex gap-6">
          {/* Left: companies tree */}
          <aside className="w-96 bg-white border p-4 rounded flex flex-col">
    <div className="flex items-center gap-2 mb-4">
      <VaultIcon size={20} variant="child" className="text-gray-700" />
      <div className="text-sm font-semibold">Vaults</div>
    </div>

            <div className="flex-1 overflow-auto">
              {companies.length === 0 ? (
                <div className="text-sm text-gray-500">No companies yet</div>
              ) : (
                <div>
                  <div className="grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-2 pb-2 border-b">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2 text-right">Boxes</div>
                  </div>
                  <ul className="mt-2">
                    {companies.map(c => (
                      <li key={c.id}>
                        <button
                          className={`w-full text-left p-2 rounded hover:bg-gray-50 ${selectedCompanyId === c.id ? 'bg-gray-100' : ''}`}
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            try { if (username) localStorage.setItem(`vaultedge:selectedVault:${username}`, c.id); } catch (e) { console.warn('failed persist selectedVault', e); }
                            try { window.dispatchEvent(new CustomEvent('vaultedge:selectedVaultChanged', { detail: { id: c.id } })); } catch (e) { console.warn('failed dispatch selectedVaultChanged', e); }
                          }}
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-6 flex items-center gap-2">
                              <VaultIcon size={20} variant={c.badge === 'parent' ? 'root' : 'child'} className="text-gray-700" />
                              <div className="text-[13px] font-medium">
                                {c.badge === 'parent' ? 'Root Vault' : ((c.name||'').length > 20 ? (c.name||'').slice(0,20) + '…' : c.name)}
                              </div>
                            </div>
                            <div className="col-span-4 text-[11px] text-gray-500 truncate" title={c.notifyEmail}>{c.notifyEmail}</div>
                            <div className="col-span-2 flex items-center justify-end gap-1 text-gray-600">
                              <SafeBoxIcon size={14} className="opacity-70" />
                              <span className="tabular-nums text-[11px] leading-none">{boxesFor(c.id).length}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* side menu now handles create/back actions; removed inline New/Exit buttons */}
          </aside>

          {/* Right: selected company details and safebox list (narrower card) */}
          <section className="flex-1">
            <div className="ve-card p-4 max-w-xl">
              {!selectedCompanyId ? (
                <div className="text-gray-600">Select a vault from the left to see associated SafeBoxes.</div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">{(() => {
                        const sel = companies.find(x => x.id === selectedCompanyId);
                        if (!sel) return '';
                        if (sel.badge === 'parent') return 'Root Vault';
                        if (sel.parentId) return sel.name && sel.name.length > 20 ? sel.name.slice(0,20) + '…' : sel.name;
                        return sel.name;
                      })()}</h2>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">{companies.find(x => x.id === selectedCompanyId)?.notifyEmail}</div>
                        <div className="text-xs text-blue-600 font-medium w-36 text-right">{companies.find(x => x.id === selectedCompanyId)?.badge === 'parent' ? 'Root Vault' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-500">{boxesFor(selectedCompanyId).length} boxes</div>
                      <button
                        onClick={() => {
                          const current = boxesFor(selectedCompanyId);
                          if (current.length === 0) return toast('No boxes to select');
                          // select all (store ids)
                          setSelectedBoxes(new Set(current.map(b => b.id)));
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      >Select all</button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Associated SafeBoxes</h3>
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {boxesFor(selectedCompanyId).length === 0 ? (
                        <div className="text-sm text-gray-500">No SafeBoxes assigned to this vault.</div>
                      ) : (
                        boxesFor(selectedCompanyId).map(b => (
                          <div key={b.id} className="flex items-center gap-3 border-b pb-2">
                            <input type="checkbox" checked={selectedBoxes.has(b.id)} onChange={() => toggleSelectBox(b.id)} />
                            <div className="font-mono text-sm flex-1">{b.name}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm">Move selected to:</label>
                    <div className="w-64">
                      <CustomSelect
                        name="moveTarget"
                        value={''}
                        onChange={(v) => moveSelectedBoxesTo(v)}
                        options={companies.filter(c => c.id !== selectedCompanyId).map(c => ({ code: c.id, name: c.name, badge: c.badge }))}
                        addDefaultOption="Y"
                        disabled={companies.length <= 1}
                      />
                    </div>
                    {companies.length <= 1 && <div className="text-xs text-gray-500">(Need more than one company to move)</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Create company modal / inline */}
            {creating && (
              <div className="mt-4 ve-card p-4">
                <h3 className="text-lg font-semibold mb-3">Create vault</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm">Name</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 block w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm">Notification email</label>
                    <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 block w-full border rounded p-2" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCompany} className="px-3 py-1 bg-blue-600 text-white rounded">Create</button>
                    <button onClick={() => setCreating(false)} className="px-3 py-1 border rounded">Cancel</button>
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
