// src/components/ReportBug.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import SideMenu from './SideMenu';
import TopNav from './TopNav';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import CustomSelect from './CustomSelect';
import { useI18n } from '../contexts/I18nContext';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ReportBug() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [data, setData] = useState({
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    severity: 'medium',
    affectedArea: '',
    attachments: [], // placeholder for future file upload
    contactEmail: ''
  });
  const draftKey = useMemo(() => `bugReportDraft:${user?.username || 'anon'}`, [user?.username]);

  const isPristine = () => {
    const d = data;
    const noText = !d.title && !d.description && !d.steps && !d.expected && !d.actual && !d.affectedArea;
    const defaultSeverity = !d.severity || d.severity === 'medium';
    const noFiles = !d.attachments || d.attachments.length === 0;
    return noText && defaultSeverity && noFiles;
  };

  // Auto-capture useful environment/context info
  const env = useMemo(() => {
    try {
      const nav = navigator || {};
      return {
        user: user?.username || '',
        role: user?.role || '',
        url: window.location.href,
        route: location.pathname,
        userAgent: nav.userAgent || '',
        language: nav.language || '',
        platform: nav.platform || '',
        screen: `${window.screen?.width || ''}x${window.screen?.height || ''}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        time: new Date().toISOString(),
        localStorageKeys: Object.keys(localStorage || {}),
      };
    } catch {
      return {};
    }
  }, [user?.username, user?.role, location.pathname]);

  // Prefill contact from owner email if present (run once per user)
  const prefilledRef = useRef(null);
  useEffect(() => {
    if (!user?.username) return;
    if (prefilledRef.current === user.username) return;
    try {
      const ownerAny = localStorage.getItem(`safeboxOwnerEmail:${user.username}:default`);
      if (ownerAny && !data.contactEmail) setData(d => ({ ...d, contactEmail: ownerAny }));
      prefilledRef.current = user.username;
    } catch (err) { console.warn('prefill contact failed', err); }
  }, [user?.username, data.contactEmail]);

  // Load draft from session storage if present
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setData(d => ({ ...d, ...parsed }));
          toast.success(t('bugReport.draft.loaded'));
        }
      }
    } catch (e) { console.warn('load draft failed', e); }
  }, [draftKey, t]);

  const saveDraft = () => {
  try { sessionStorage.setItem(draftKey, JSON.stringify(data)); toast.success(t('bugReport.draft.saved')); }
  catch (e) { console.warn('save draft failed', e); toast.error(t('bugReport.draft.saveError')); }
  };
  const clearDraft = () => { try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } };

  const exitToPrevious = () => {
    // Try to go back, else go to dashboard
    try { navigate(-1); } catch { navigate('/dashboard'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitNow();
  };

  const submitNow = async () => {
    if (!data.title || !data.description) {
  toast.error(t('bugReport.error.missingTitleDesc'));
      return;
    }
    setSubmitting(true);
    try {
      // Simulate sending to backend/support. For now, console + toast.
      const payload = { ...data, env };
      console.log('[bug-report] submitted', payload);
  toast.success(t('bugReport.success'));
      // reset crucial fields; keep contactEmail
      setData(d => ({ ...d, title: '', description: '', steps: '', expected: '', actual: '', affectedArea: '' }));
      clearDraft();
      // Close screen after submit
      exitToPrevious();
    } catch (e) {
      console.warn('bug submit failed', e);
  toast.error(t('bugReport.error.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} onLogout={logout} hideSearch />
        <main className="p-6 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">{t('bugReport.title')}</h1>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (isPristine()) { exitToPrevious(); } else { setShowCloseConfirm(true); } }} className="px-3 py-1 border rounded text-xs text-gray-700 hover:bg-gray-50">{t('bugReport.close')}</button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="ve-card p-4 max-w-3xl space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.title')}</label>
              <input value={data.title} onChange={e=>setData({...data,title:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="Short summary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.where')}</label>
              <input value={data.affectedArea} onChange={e=>setData({...data,affectedArea:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="e.g., Dashboard, Audit Log, SafeBox XYZ" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.description')}</label>
              <textarea value={data.description} onChange={e=>setData({...data,description:e.target.value})} className="w-full border rounded px-2 py-1 min-h-[90px]" placeholder="What happened?" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.steps')}</label>
                <textarea value={data.steps} onChange={e=>setData({...data,steps:e.target.value})} className="w-full border rounded px-2 py-1 min-h-[80px]" placeholder="1) ... 2) ..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.expected')}</label>
                <textarea value={data.expected} onChange={e=>setData({...data,expected:e.target.value})} className="w-full border rounded px-2 py-1 min-h-[80px]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.actual')}</label>
              <textarea value={data.actual} onChange={e=>setData({...data,actual:e.target.value})} className="w-full border rounded px-2 py-1 min-h-[80px]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <CustomSelect
                  label={t('bugReport.field.severity')}
                  name="severity"
                  value={data.severity}
                  onChange={(v) => setData(d => ({ ...d, severity: v }))}
                  options={[{ code: 'low', name: t('bugReport.severity.low') }, { code: 'medium', name: t('bugReport.severity.medium') }, { code: 'high', name: t('bugReport.severity.high') }, { code: 'critical', name: t('bugReport.severity.critical') }]}
                  addDefaultOption="N"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.contact')}</label>
                <input type="email" value={data.contactEmail} onChange={e=>setData({...data,contactEmail:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bugReport.field.attachments')}</label>
                <input type="file" multiple disabled className="w-full border rounded px-2 py-1 text-gray-400" title="Coming soon" />
              </div>
            </div>

            <details className="bg-gray-50 border rounded p-3">
              <summary className="cursor-pointer text-xs text-gray-700">{t('bugReport.field.env')}</summary>
              <pre className="text-[11px] text-gray-700 overflow-auto mt-2">{JSON.stringify(env, null, 2)}</pre>
            </details>

            <div className="pt-2">
              <button type="submit" disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                {submitting ? t('bugReport.button.submitting') : t('bugReport.button.submit')}
              </button>
            </div>
          </form>

          {showCloseConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg w-[420px] p-4 text-sm">
                <h2 className="text-base font-semibold mb-2">{t('bugReport.close.title')}</h2>
                <p className="mb-3 text-gray-700">{t('bugReport.close.message')}</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { saveDraft(); setShowCloseConfirm(false); exitToPrevious(); }} className="px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600">{t('bugReport.close.save')}</button>
                  <button onClick={async () => { setShowCloseConfirm(false); await submitNow(); }} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={submitting}>{t('bugReport.close.send')}</button>
                  <button onClick={() => { clearDraft(); setShowCloseConfirm(false); exitToPrevious(); }} className="px-3 py-2 border rounded hover:bg-gray-50">{t('bugReport.close.exit')}</button>
                  <button onClick={() => setShowCloseConfirm(false)} className="px-3 py-2 text-xs text-gray-600 hover:underline self-start">{t('bugReport.close.cancel')}</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
