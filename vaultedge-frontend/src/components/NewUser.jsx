// src/components/NewUser.jsx
import React, { useState, useEffect } from 'react';
import SideMenu from './SideMenu';
import TopNav from './TopNav';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

export default function NewUser() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', email: '', firstName: '', lastName: '', role: 'user', password: '', confirm: '' });
  const [pwIssues, setPwIssues] = useState([]);
  const [confirmIssue, setConfirmIssue] = useState(null);
  const [firstNameIssue, setFirstNameIssue] = useState(null);
  const [lastNameIssue, setLastNameIssue] = useState(null);
  const [emailIssue, setEmailIssue] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const setField = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const NAME_MAX = 64;
  const validateName = (raw) => {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;
    if (value.length > NAME_MAX) return `Max ${NAME_MAX} chars`;
    const base = /^[\p{L}\p{M}](?:[\p{L}\p{M}'\-. ]*[\p{L}\p{M}])?$/u;
    if (!base.test(value)) return "Only letters, spaces, apostrophe ('), hyphen (-) or period (.)";
    if (/( {2,}|--|''|\.\.|[-' .]{2,})/.test(value)) return 'No repeated separators';
    return null;
  };

  const EMAIL_MAX = 254;
  const validateEmail = (raw) => {
    if (!raw) return null;
    const v = raw.trim();
    if (!v) return null;
    if (v.length > EMAIL_MAX) return `Email too long (max ${EMAIL_MAX})`;
    const atIndex = v.indexOf('@');
    if (atIndex < 1 || atIndex === v.length - 1) return 'Invalid email format';
    const local = v.slice(0, atIndex);
    const domain = v.slice(atIndex + 1);
    if (local.length > 64) return 'Local part too long (>64)';
    if (!/^[A-Za-z0-9!#$%&'*+/?^_`{|}~.-]+$/.test(local)) return 'Invalid characters in local part';
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return 'Dots misused in local part';
    if (!/^[A-Za-z0-9.-]+$/.test(domain)) return 'Invalid characters in domain';
    if (domain.startsWith('-') || domain.endsWith('-') || domain.startsWith('.') || domain.endsWith('.')) return 'Domain boundary invalid';
    if (domain.includes('..')) return 'Domain has consecutive dots';
    const labels = domain.split('.');
    if (labels.length < 2) return 'Domain needs a TLD';
    if (labels.some(l => !l.length)) return 'Empty domain label';
    if (labels.some(l => l.length > 63)) return 'Domain label too long (>63)';
    if (!/^[A-Za-z]{2,63}$/.test(labels[labels.length - 1])) return 'Invalid TLD';
    return null;
  };

  useEffect(() => {
    const issues = [];
    const p = form.password || '';
    if (p.length && p.length < 8) issues.push(t('validation.password.minLength'));
    if (p.length && !/[A-Za-z]/.test(p)) issues.push(t('validation.password.letter'));
    if (p.length && !/[0-9]/.test(p)) issues.push(t('validation.password.digit'));
    setPwIssues(issues);
    if (form.confirm.length) {
      setConfirmIssue(form.password === form.confirm ? null : t('validation.password.mismatch'));
    } else {
      setConfirmIssue(null);
    }
    setFirstNameIssue(validateName(form.firstName));
    setLastNameIssue(validateName(form.lastName));
    setEmailIssue(validateEmail(form.email));
  }, [form.password, form.confirm, form.firstName, form.lastName, form.email, t]);

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null); setError(null);
    if (!form.username.trim()) return setError(t('validation.username.required'));
    if (form.username.length < 3) return setError(t('validation.username.tooShort'));
    if (firstNameIssue) return setError(t('newUser.firstName') + ': ' + firstNameIssue);
    if (lastNameIssue) return setError(t('newUser.lastName') + ': ' + lastNameIssue);
    if (emailIssue) return setError(t('newUser.email') + ': ' + emailIssue);
    if (!form.password) return setError(t('validation.password.required'));
    if (pwIssues.length) return setError(t('validation.password.required') + ': ' + pwIssues.join(', '));
    if (form.password !== form.confirm) return setError(t('validation.password.mismatch'));
    try {
      setSubmitting(true);
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email?.trim() || null,
          firstName: form.firstName?.trim() || null,
          lastName: form.lastName?.trim() || null,
          role: form.role || 'user',
          password: form.password
        })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || t('newUser.error.create'));
      }
      const data = await resp.json();
      setMessage(t('newUser.created', { username: data.username }));
      setForm({ username: '', email: '', firstName: '', lastName: '', role: 'user', password: '', confirm: '' });
      setFirstNameIssue(null); setLastNameIssue(null); setEmailIssue(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} />
        <main className="p-6 overflow-auto max-w-3xl">
          <h1 className="text-2xl font-semibold mb-4">{t('newUser.title')}</h1>
          <form onSubmit={submit} className="space-y-4 bg-white border rounded p-4 shadow-sm">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>}
            {message && <div className="text-sm text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded">{message}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.username')}</label>
                <input value={form.username} onChange={e=> setField('username', e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" placeholder={t('newUser.username.placeholder')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e=> setField('email', e.target.value)}
                  className={`mt-1 w-full border rounded px-2 py-1.5 text-sm ${emailIssue ? 'border-red-400' : ''}`}
                  placeholder={t('newUser.email.placeholder')}
                  onBlur={() => setEmailIssue(validateEmail(form.email))}
                  autoComplete="email"
                />
                {emailIssue && <p className="mt-1 text-[11px] text-red-600">{emailIssue}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.firstName')}</label>
                <input
                  value={form.firstName}
                  onChange={e=> setField('firstName', e.target.value)}
                  onBlur={() => setFirstNameIssue(validateName(form.firstName))}
                  className={`mt-1 w-full border rounded px-2 py-1.5 text-sm ${firstNameIssue ? 'border-red-400' : ''}`}
                  placeholder={t('newUser.firstName.placeholder')}
                  autoComplete="given-name"
                />
                {firstNameIssue && <p className="mt-1 text-[11px] text-red-600">{firstNameIssue}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.lastName')}</label>
                <input
                  value={form.lastName}
                  onChange={e=> setField('lastName', e.target.value)}
                  onBlur={() => setLastNameIssue(validateName(form.lastName))}
                  className={`mt-1 w-full border rounded px-2 py-1.5 text-sm ${lastNameIssue ? 'border-red-400' : ''}`}
                  placeholder={t('newUser.lastName.placeholder')}
                  autoComplete="family-name"
                />
                {lastNameIssue && <p className="mt-1 text-[11px] text-red-600">{lastNameIssue}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.role')}</label>
                <select value={form.role} onChange={e=> setField('role', e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 text-sm">
                  <option value="user">{t('newUser.role.user')}</option>
                  <option value="admin">{t('newUser.role.admin')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.password')}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e=> setField('password', e.target.value)}
                  className={`mt-1 w-full border rounded px-2 py-1.5 text-sm ${pwIssues.length ? 'border-red-400' : ''}`}
                  onBlur={() => { if (!form.password) setPwIssues([t('validation.password.required')]); }}
                />
                {pwIssues.length > 0 && (
                  <ul className="mt-1 ml-1 text-[11px] text-red-600 list-disc list-inside space-y-0.5">
                    {pwIssues.map(r => <li key={r}>{r}</li>)}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('newUser.password.confirm')}</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={e=> setField('confirm', e.target.value)}
                  className={`mt-1 w-full border rounded px-2 py-1.5 text-sm ${confirmIssue ? 'border-red-400' : ''}`}
                />
                {confirmIssue && <div className="mt-1 ml-1 text-[11px] text-red-600">{confirmIssue}</div>}
              </div>
            </div>
            <div className="pt-2 flex gap-3">
              <button type="submit" disabled={submitting || pwIssues.length > 0 || !!confirmIssue || firstNameIssue || lastNameIssue || emailIssue} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{submitting ? t('newUser.button.creating') : t('newUser.button.create')}</button>
              <button type="button" onClick={()=> { setForm({ username: '', email: '', firstName: '', lastName: '', role: 'user', password: '', confirm: '' }); setPwIssues([]); setConfirmIssue(null); setFirstNameIssue(null); setLastNameIssue(null); setEmailIssue(null); }} className="px-4 py-2 border rounded text-sm">{t('newUser.button.clear')}</button>
            </div>
            <p className="text-[11px] text-gray-500">{t('newUser.fieldsRequired')}</p>
            <p className="text-[10px] text-gray-400">{t('newUser.guidelines')}</p>
          </form>
        </main>
      </div>
    </div>
  );
}
