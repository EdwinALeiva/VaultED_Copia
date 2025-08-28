/**
 * TopNav.jsx
 * -----------------------------------------------------
 * Top header with VaultEdge branding and hamburger menu.
 * - Shows logo or title
 * - Right-aligned 3-line hamburger (gray)
 * - Dropdown menu with main navigation options
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Settings, CreditCard, PlusSquare, Upload, LogOut, Search } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

export default function TopNav({
  onLogout,
  hideSearch = false,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search…',
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const controlled = typeof searchValue === 'string' && typeof onSearchChange === 'function';
  const [internalValue, setInternalValue] = useState('');
  const value = controlled ? searchValue : internalValue;
  const { t, languages, lang, switchLanguage } = useI18n();

  const submitSearch = () => {
    if (controlled) {
      onSearchSubmit && onSearchSubmit(value);
    } else {
      // no-op for now; could emit global event
      try { window.dispatchEvent(new CustomEvent('vaultedge:globalSearch', { detail: { value } })); } catch {/* ignore */}
    }
  };

  return (
  <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center border-b border-gray-200">
      {/* VaultEdge Branding (logo or text) */}
      <div className="flex items-center gap-2">
  <div className="text-xl font-bold text-blue-700 select-none">
          <span className="inline-block align-middle mr-1">🔐</span>
          VaultEdge
        </div>
        {!hideSearch && (
          <div className="hidden md:flex relative ml-6">
            <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
            <input
              placeholder={searchPlaceholder}
              value={value}
              onChange={(e) => controlled ? onSearchChange(e.target.value) : setInternalValue(e.target.value)}
              onKeyDown={(e)=> { if (e.key==='Enter') submitSearch(); }}
              onBlur={submitSearch}
              className="pl-7 pr-14 py-2 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            {value && (
              <button
                type="button"
                onClick={() => { controlled ? onSearchChange('') : setInternalValue(''); onSearchSubmit && onSearchSubmit(''); }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1.5 inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hamburger Menu Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="w-9 h-9 inline-flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Dropdown Menu (absolute, right-aligned) */}
      {open && (
        <div className="absolute right-4 top-16 bg-white border border-gray-200 rounded-md shadow-lg w-60 z-50 py-1 text-sm">
          <ul className="text-gray-700">
            <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('menu.globalActions') || 'Global Actions'}</li>
            <MenuItem icon={<PlusSquare size={16} />} label={t('menu.createSafebox') || 'Create SafeBox'} />
            <MenuItem icon={<Upload size={16} />} label={t('menu.uploadFile') || 'Upload File'} />
            <MenuItem icon={<Settings size={16} />} label={t('menu.settings') || 'Settings'} onClick={() => { setOpen(false); navigate('/settings'); }} />
            <MenuItem icon={<CreditCard size={16} />} label={t('menu.billing') || 'Billing & Subscription'} />
            <li className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('settings.languageLabel') || 'Language'}</li>
            <li className="px-3 pb-2">
              <select
                value={lang}
                onChange={(e)=> switchLanguage(e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </li>
            <li className="border-t border-gray-200 mt-1" />
            <button onClick={() => { try { window.dispatchEvent(new CustomEvent('vaultedge:logout')); } catch (e) { console.warn('logout event dispatch failed', e); } onLogout && onLogout(); }} className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50">
              <LogOut size={16} /> {t('logout') || 'Logout'}
            </button>
          </ul>
        </div>
      )}
    </header>
  );
}

function MenuItem({ icon, label, onClick }) {
  return (
    <li>
      <button
        onClick={onClick}
  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-left"
      >
        {icon} <span>{label}</span>
      </button>
    </li>
  );
}
