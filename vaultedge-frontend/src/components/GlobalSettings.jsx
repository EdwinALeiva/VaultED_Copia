import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import { toast } from 'react-hot-toast';

export default function GlobalSettings() {
  const { user } = useAuth();
  const { t } = useI18n();
  const username = user?.username;
  const [lang, setLang] = useState('ENG');

  useEffect(() => {
    if (!username) return;
    try {
      const existing = localStorage.getItem(`vaultedge:lang:${username}`) || localStorage.getItem('vaultedge:lang:default') || 'ENG';
      setLang(existing);
    } catch (e) { console.warn('failed read lang', e); }
  }, [username]);

  const save = () => {
    if (!username) return toast.error(t('vaults.toasts.signInFirst'));
    try {
      localStorage.setItem(`vaultedge:lang:${username}`, lang);
      toast.success(t('settings.global.saved'));
    } catch (e) { console.warn('failed save settings', e); toast.error(t('settings.global.saveError')); }
  };

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav />
        <main className="p-6">
          <div className="ve-card p-4 max-w-lg">
            <h1 className="text-xl font-semibold mb-3">{t('settings.global.title')}</h1>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">{t('settings.global.defaultLanguage')}</label>
              <select value={lang} onChange={(e)=> setLang(e.target.value)} className="mt-1 block w-32 border rounded p-2">
                <option value="ENG">ENG</option>
                <option value="SPA">SPA</option>
                <option value="FRA">FRA</option>
                <option value="POR">POR</option>
                <option value="DEU">DEU</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">{t('settings.global.help')}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded">{t('settings.global.save')}</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
