// src/components/SideMenu.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home as HomeIcon,
  FileText as AuditIcon,
  PlusSquare as NewBoxIcon,
  Upload as UploadIcon,
  Settings2 as BoxSettingsIcon,
  Building,
  Clock,
  HelpCircle,
  Share2,
  History,
  Download,
  Info,
  RefreshCcw,
  Trash,
  RotateCcw,
  Bug,
  UserPlus
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

export default function SideMenu() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();

  // read vaults count from localStorage so we can disable assign action when only one vault
  const companiesList = React.useMemo(() => {
    try {
      if (!user?.username) return [];
      const raw = localStorage.getItem(`vaultedge:vaults:${user.username}`) || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [user?.username]);

  const context = useMemo(() => {
  if (/^\/safebox\//.test(location.pathname)) return 'safebox';
  if (/^\/preview\//.test(location.pathname)) return 'preview';
  if (/^\/vaults/.test(location.pathname)) return 'companies';
    return 'dashboard';
  }, [location.pathname]);


  // Home item (always first)
  const homeItem = { to: '/dashboard', icon: <HomeIcon size={20} />, label: t('menu.home') };

  // Dashboard (landing) requested options and order
  const dashboardMenu = [
  // Reordered so "New" appears immediately after Home
  { icon: <NewBoxIcon size={20} />, label: t('menu.new'), newMenu: true },
  { to: '/vaults', icon: <Building size={20} />, label: t('menu.vaults') },
    { to: '#refresh', icon: <RefreshCcw size={20} />, label: t('menu.refresh'), onClick: () => { try { window.dispatchEvent(new CustomEvent('vaultedge:refreshDashboard')); } catch (e) { console.warn('refresh dispatch failed', e); } } },
    ...(user && (user.username === 'demo' || user.role === 'admin') ? [ { to: '/report-bug', icon: <Bug size={20} />, label: t('menu.reportBug') } ] : []),
  ];

  const safeboxExtras = [
  { icon: <BoxSettingsIcon size={20} />, label: t('safebox.boxSettings'), onClick: () => { window.dispatchEvent(new CustomEvent('vaultedge:openBoxSettings')); } },
  { icon: <Share2 size={20} />, label: t('safebox.share'), disabled: true },
  { icon: <History size={20} />, label: t('safebox.versionHistory'), disabled: true },
  ];

  const companiesExtras = [
  { to: '/vaults#create', icon: <NewBoxIcon size={20} />, label: t('vault.create'), onClick: () => { navigate('/vaults'); try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsAction', { detail: { action: 'create' } })); } catch { /* ignore */ } } },
  { icon: <Building size={20} />, label: t('vault.manage'), onClick: () => { navigate('/vaults'); try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsAction', { detail: { action: 'manage' } })); } catch { /* ignore */ } } },
  { icon: <Share2 size={20} />, label: t('vault.associate'), disabled: companiesList.length <= 1, onClick: () => { navigate('/vaults'); try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsAction', { detail: { action: 'assign' } })); } catch { /* ignore */ } } },
  { icon: <Trash size={20} />, label: t('vault.delete'), onClick: () => { navigate('/vaults'); try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsAction', { detail: { action: 'delete' } })); } catch { /* ignore */ } } },
  ];

  const previewExtras = [
  { to: location.pathname + '/download', icon: <Download size={20} />, label: t('preview.download'), disabled: true },
  { to: location.pathname + '/compare', icon: <History size={20} />, label: t('preview.compare'), disabled: true },
  { to: location.pathname + '/meta', icon: <Info size={20} />, label: t('preview.metadata'), disabled: true },
  ];

  // Shared footer items that should always appear at the end
  const contactItem = { to: '/support', icon: <HelpCircle size={20} />, label: t('support.contact'), onClick: () => navigate('/support') };
  const auditItem = { to: '/audit', icon: <AuditIcon size={20} />, label: t('audit.log'), onClick: () => navigate('/audit') };
  const backItem = { to: '/dashboard', icon: <RotateCcw size={20} />, label: t('nav.back'), onClick: () => navigate('/dashboard') };

  // Build per-context main actions (exclude Home, Contact, Audit, Back)
  const pageActions = context === 'safebox' ? [...safeboxExtras]
    : context === 'preview' ? [...previewExtras]
    : context === 'companies' ? [...companiesExtras]
    : [...dashboardMenu];

  // Final items: Home first, then page actions, then Contact, Audit, and Back (Back omitted on dashboard)
  const items = [homeItem, ...pageActions, contactItem, auditItem, ...(context === 'dashboard' ? [] : [backItem])];

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (!newMenuOpen) return;
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [newMenuOpen]);

  const openCreateVault = () => {
    navigate('/vaults');
    try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsAction', { detail: { action: 'create' } })); } catch {/* ignore */}
    setNewMenuOpen(false);
  };
  const openNewSafeBox = () => {
    navigate('/new-safebox');
    setNewMenuOpen(false);
  };
  const openNewUser = () => {
    navigate('/new-user');
    setNewMenuOpen(false);
  };

  return (
  <nav className={`${expanded ? 'w-56' : 'w-16'} bg-gray-900 text-gray-300 flex flex-col py-4 transition-[width] duration-200 border-r border-gray-800 relative`}>      
      <ul className="flex-1 space-y-1 px-2 w-full">
        {items.map(item => {
          const active = item.to && location.pathname === item.to;
          return (
            <li key={item.label}>
              {item.newMenu ? (
                <div ref={newMenuRef} className="relative">
                  <button
                    onClick={() => setNewMenuOpen(o=>!o)}
                    className={`group flex items-center w-full gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${newMenuOpen ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title={t('menu.new')}
                  >
                    {item.icon}
                    {expanded && <span className="truncate flex-1">{t('menu.new')}</span>}
                    {expanded && <span className="text-xs opacity-60">▾</span>}
                  </button>
                  {newMenuOpen && (
                    <div className={`absolute ${expanded ? 'left-full ml-1 top-0' : 'left-full ml-2 top-0'} bg-gray-800/95 backdrop-blur border border-gray-700 rounded-md shadow-lg w-48 z-50 p-1` }>
                      <button onClick={openCreateVault} className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm hover:bg-gray-700 text-gray-200">
                        <Building size={18} className="text-gray-300" />
                        <span className="flex-1 text-left">{t('entity.vault')}</span>
                      </button>
                      <button onClick={openNewSafeBox} className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm hover:bg-gray-700 text-gray-200">
                        <NewBoxIcon size={18} className="text-gray-300" />
                        <span className="flex-1 text-left">{t('entity.safebox')}</span>
                      </button>
                      <button onClick={openNewUser} className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm hover:bg-gray-700 text-gray-200">
                        <UserPlus size={18} className="text-gray-300" />
                        <span className="flex-1 text-left">{t('entity.user')}</span>
                        <span className="text-[10px] px-1 rounded bg-blue-600 text-white">{t('label.beta')}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    if (item.onClick) { item.onClick(); return; }
                    if (item.to) navigate(item.to);
                  }}
                  className={`group flex items-center w-full gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'} ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={item.label}
                >
                  {item.icon}
                  {expanded && <span className="truncate">{item.label}</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => setExpanded(e=>!e)}
        className="mx-2 mt-auto mb-2 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-800 h-10"
  title={expanded ? t('nav.collapse') : t('nav.expand')}
      >
  {expanded ? '«' : '»'}
      </button>
    </nav>
  );
}
