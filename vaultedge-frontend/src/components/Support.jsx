// src/components/Support.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import SideMenu from './SideMenu';
import TopNav from './TopNav';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomSelect from './CustomSelect';
import { useI18n } from '../contexts/I18nContext';

/**
 * Unified "Contact Us" / Support screen replacing the prior Bug Report page.
 * Allows users to send: questions, suggestions, documentation requests,
 * billing detail requests, and other messages. Auto‑captures environment context.
 */
export default function Support() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const [data, setData] = useState({
    type: 'question', // question | suggestion | documentation | billing | other
    subject: '',
    message: '',
    docArea: '', // only for documentation requests
    billingPeriod: '', // only for billing requests
    contactEmail: '',
    attachments: [] // placeholder for future file uploads
  });

  const draftKey = useMemo(() => `contactDraft:${user?.username || 'anon'}`, [user?.username]);

  const isPristine = () => {
    const { subject, message, docArea, billingPeriod, attachments } = data;
    const baseEmpty = !subject && !message && !docArea && !billingPeriod;
    const noFiles = !attachments || attachments.length === 0;
    return baseEmpty && noFiles && data.type === 'question' && !data.contactEmail;
  };

  // Environment capture (read‑only) for support context
  const env = useMemo(() => {
    try {
      const nav = navigator || {};
      return {
        user: user?.username || '',
        route: location.pathname,
        url: window.location.href,
        userAgent: nav.userAgent || '',
        language: nav.language || '',
        platform: nav.platform || '',
        screen: `${window.screen?.width || ''}x${window.screen?.height || ''}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        time: new Date().toISOString(),
        localStorageKeys: Object.keys(localStorage || {})
      };
    } catch { return {}; }
  }, [user?.username, location.pathname]);

  // Prefill contact email from stored owner email if present
  const prefilledRef = useRef(null);
  useEffect(() => {
    if (!user?.username) return;
    if (prefilledRef.current === user.username) return;
    try {
      // Try any safebox owner email heuristically
      const keys = Object.keys(localStorage).filter(k => k.startsWith(`safeboxOwnerEmail:${user.username}:`));
      const first = keys.length ? localStorage.getItem(keys[0]) : '';
      if (first && !data.contactEmail) setData(d => ({ ...d, contactEmail: first }));
      prefilledRef.current = user.username;
    } catch (e) { console.warn('prefill contact failed', e); }
  }, [user?.username, data.contactEmail]);

  // Load draft from session storage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setData(d => ({ ...d, ...parsed }));
          toast.success(t('support.draft.loaded'));
        }
      }
    } catch (e) { console.warn('load draft failed', e); }
  }, [draftKey, t]);

  const saveDraft = () => {
  try { sessionStorage.setItem(draftKey, JSON.stringify(data)); toast.success(t('support.draft.saved')); }
  catch (e) { console.warn('save draft failed', e); toast.error(t('support.draft.saveError')); }
  };
  const clearDraft = () => { try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } };

  const exitToPrevious = () => { try { navigate(-1); } catch { navigate('/dashboard'); } };

  const validate = () => {
    if (!data.subject.trim() || !data.message.trim()) {
  toast.error(t('support.validate.subjectMessage'));
      return false;
    }
    if (data.type === 'documentation' && !data.docArea.trim()) {
  toast.error(t('support.validate.docArea'));
      return false;
    }
    if (data.type === 'billing' && !data.billingPeriod.trim()) {
  toast.error(t('support.validate.billingPeriod'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => { e.preventDefault(); await submitNow(); };

  const submitNow = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = { ...data, env };
      console.log('[contact-request] submitted', payload);
  toast.success(t('support.success'));
      // Reset primary fields; keep contactEmail + type
      setData(d => ({ ...d, subject: '', message: '', docArea: '', billingPeriod: '' }));
      clearDraft();
      exitToPrevious();
    } catch (e) {
      console.warn('contact submit failed', e);
  toast.error(t('support.error.submit'));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} onLogout={logout} hideSearch />
        <main className="p-6 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">{t('support.title')}</h1>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (isPristine()) exitToPrevious(); else setShowCloseConfirm(true); }} className="px-3 py-1 border rounded text-xs text-gray-700 hover:bg-gray-50">{t('support.close')}</button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="ve-card p-4 max-w-3xl space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <CustomSelect
                  label={t('support.type')}
                  name="supportType"
                  value={data.type}
                  onChange={(v) => setData(d => ({ ...d, type: v }))}
                  options={[
                    { code: 'question', name: 'Pregunta / Question' },
                    { code: 'suggestion', name: 'Sugerencia / Suggestion' },
                    { code: 'documentation', name: 'Documentación / Documentation' },
                    { code: 'billing', name: 'Facturación / Billing' },
                    { code: 'other', name: 'Otro / Other' },
                  ]}
                  addDefaultOption="N"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.subject')}</label>
                <input value={data.subject} onChange={e=>setData({...data,subject:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="Breve asunto / Short subject" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.message')}</label>
              <textarea value={data.message} onChange={e=>setData({...data,message:e.target.value})} className="w-full border rounded px-2 py-2 min-h-[140px]" placeholder="Detalles de su consulta / Provide details" />
            </div>

            {data.type === 'documentation' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.docArea')}</label>
                <input value={data.docArea} onChange={e=>setData({...data,docArea:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="p.ej. API, Integración, Seguridad" />
              </div>
            )}

            {data.type === 'billing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.billingPeriod')}</label>
                  <input value={data.billingPeriod} onChange={e=>setData({...data,billingPeriod:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="e.g. 2025-Q3" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.contactEmail')}</label>
                  <input type="email" value={data.contactEmail} onChange={e=>setData({...data,contactEmail:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="you@example.com" />
                </div>
              </div>
            )}

            {data.type !== 'billing' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.contactEmail')}</label>
                <input type="email" value={data.contactEmail} onChange={e=>setData({...data,contactEmail:e.target.value})} className="w-full border rounded px-2 py-1" placeholder="you@example.com" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('support.attachments')}</label>
                <input type="file" disabled multiple className="w-full border rounded px-2 py-1 text-gray-400" title="Coming soon" />
              </div>
            </div>

            <details className="bg-gray-50 border rounded p-3">
              <summary className="cursor-pointer text-xs text-gray-700">{t('support.envDetails')}</summary>
              <pre className="text-[11px] text-gray-700 overflow-auto mt-2">{JSON.stringify(env, null, 2)}</pre>
            </details>

            <div className="pt-2 flex gap-2">
              <button type="submit" disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                {submitting ? t('support.button.sending') : t('support.button.send')}
              </button>
              <button type="button" onClick={saveDraft} className="px-3 py-1 border rounded text-xs hover:bg-gray-50">{t('support.button.saveDraft')}</button>
            </div>
          </form>

          {showCloseConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg w-[420px] p-4 text-sm">
                <h2 className="text-base font-semibold mb-2">{t('support.close.title')}</h2>
                <p className="mb-3 text-gray-700">{t('support.close.message')}</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { saveDraft(); setShowCloseConfirm(false); exitToPrevious(); }} className="px-3 py-2 bg-amber-500 text-white rounded hover:bg-amber-600">{t('support.close.save')}</button>
                  <button onClick={async () => { setShowCloseConfirm(false); await submitNow(); }} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={submitting}>{t('support.close.send')}</button>
                  <button onClick={() => { clearDraft(); setShowCloseConfirm(false); exitToPrevious(); }} className="px-3 py-2 border rounded hover:bg-gray-50">{t('support.close.exit')}</button>
                  <button onClick={() => setShowCloseConfirm(false)} className="px-3 py-2 text-xs text-gray-600 hover:underline self-start">{t('support.close.cancel')}</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
