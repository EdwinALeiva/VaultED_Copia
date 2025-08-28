// src/components/NewSafeBox.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import { storageApi } from '../services/storageApi';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import CustomSelect from './CustomSelect';
import { ensureRegistryForNames } from '../services/safeboxRegistry';
import { useI18n } from '../contexts/I18nContext';

export default function NewSafeBox() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [securityType, setSecurityType] = useState('standard'); // 'standard' | 'dual-key'
  const [sizeGiB, setSizeGiB] = useState('10'); // string GiB
  const [submitting, setSubmitting] = useState(false);
  const [vaults, setVaults] = useState([]);
  const [companyId, setCompanyId] = useState('default');

  const sizeOptions = useMemo(() => [
    { label: '1 GB', value: '1' },
    { label: '5 GB', value: '5' },
    { label: '10 GB', value: '10' },
    { label: '50 GB', value: '50' },
    { label: '100 GB', value: '100' },
  ], []);

  const handleSubmit = async (e) => {
    e.preventDefault();
  const trimmed = name.trim();
  if (!trimmed) return;
  if (trimmed.length > 64) { toast.error(t('newSafebox.error.nameLength')); return; }
    if (!user?.username) {
  toast.error(t('newSafebox.error.userMissing'));
      return;
    }
    try {
      setSubmitting(true);
      // Ensure the user root exists, then create the safebox (folder under user)
      await storageApi.ensureUser(user.username);
      await storageApi.createSafeBox(user.username, trimmed);
      // Persist selected metadata for this SafeBox (used by Dashboard meta display)
      try {
        const createdAt = new Date().toISOString();
        const securityKeys = securityType === 'dual-key' ? 2 : 1;
        const boxType = 'Personal';
        const capacityBytes = parseInt(sizeGiB, 10) * 1024 * 1024 * 1024;
        const meta = { createdAt, boxType, securityKeys, capacityBytes };
  // register this safebox name in registry and obtain a stable id
  const safeName = trimmed.length > 64 ? trimmed.slice(0,64) : trimmed;
  const ids = ensureRegistryForNames(user.username, [safeName]);
  const sbId = ids[0];
  localStorage.setItem(`safeboxMeta:${user.username}:${sbId}`, JSON.stringify({ ...meta, name: safeName }));
  // also keep legacy meta keyed by name for compatibility
  try { localStorage.setItem(`safeboxMeta:${user.username}:${safeName}`, JSON.stringify({ ...meta, name: safeName })); } catch (err) { console.warn('failed to write legacy meta', err); }
        // persist vault assignment locally keyed by id
        try {
          if (companyId && companyId !== 'default') {
            localStorage.setItem(`safeboxVault:${user.username}:${sbId}`, companyId);
          } else {
            // if user hasn't picked a vault, default to selectedVault
            const sel = localStorage.getItem(`vaultedge:selectedVault:${user.username}`);
            if (sel) localStorage.setItem(`safeboxVault:${user.username}:${sbId}`, sel);
          }
        } catch (e) { console.warn('failed to persist safeboxVault', e); }
  } catch (e) { console.warn('failed to persist safebox meta', e); }
  toast.success(t('newSafebox.success'));
      navigate('/dashboard');
    } catch (err) {
  toast.error(err?.response?.data?.message || t('newSafebox.error.create'));
    } finally {
      setSubmitting(false);
    }
  };

  // load companies for select
  React.useEffect(() => {
    if (!user?.username) return;
    try {
      const raw = localStorage.getItem(`vaultedge:vaults:${user.username}`) || '[]';
      const parsed = JSON.parse(raw);
      setVaults(Array.isArray(parsed) ? parsed : []);
      const pref = localStorage.getItem(`vaultedge:selectedVault:${user.username}`);
      if (pref) setCompanyId(pref); else setCompanyId('default');
    } catch {
      setVaults([]);
      setCompanyId('default');
    }
  }, [user?.username]);

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} onLogout={logout} />
        <main className="p-6">
          <h1 className="text-2xl font-semibold mb-4">{t('newSafebox.title')}</h1>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md ve-card p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('newSafebox.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={t('newSafebox.name.placeholder')}
                className="mt-1 block w-full border rounded p-2"
              />
            </div>
            <div>
              <CustomSelect
                label={t('newSafebox.securityType')}
                name="securityType"
                value={securityType}
                onChange={(v) => setSecurityType(v)}
                options={[{ code: 'standard', name: t('newSafebox.security.standard') }, { code: 'dual-key', name: t('newSafebox.security.dual') }]}
                addDefaultOption="N"
              />
              <p className="text-[11px] text-gray-500 mt-1">{t('newSafebox.security.help')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('newSafebox.size')}</label>
              <CustomSelect
                label={t('newSafebox.size')}
                name="sizeGiB"
                value={sizeGiB}
                onChange={(v) => setSizeGiB(v)}
                options={sizeOptions.map(s => ({ code: s.value, name: s.label }))}
                addDefaultOption="N"
              />
              <p className="text-[11px] text-gray-500 mt-1">{t('newSafebox.size.help')}</p>
            </div>

            {vaults && vaults.length > 0 && (
              <div>
                <CustomSelect
                  label={t('newSafebox.vault')}
                  name="vault"
                  value={companyId}
                  onChange={(v) => setCompanyId(v)}
                  options={vaults.map(c => ({ code: c.id, name: c.name, badge: c.badge }))}
                  addDefaultOption="Y"
                />
                <p className="text-[11px] text-gray-500 mt-1">{t('newSafebox.vault.help')}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t('newSafebox.button.creating') : t('newSafebox.button.create')}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
