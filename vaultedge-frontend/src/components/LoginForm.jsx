import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import { mockApi } from '../services/mockApi';
import { useI18n } from '../contexts/I18nContext';

export default function LoginForm({ onLogin }) {
  const { t, switchLanguage, languages } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [localLang, setLocalLang] = useState(() => {
    try { return localStorage.getItem('vaultedge:lang:default') || 'en'; } catch { return 'en'; }
  });

  useEffect(() => { switchLanguage(localLang); }, [localLang, switchLanguage]);
  // const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await mockApi.login({ username, password });
  localStorage.setItem('token', response.token);
  // Pass the username up so App can navigate to the last safebox if available
  // Persist selected language for this user
  try { localStorage.setItem(`vaultedge:lang:${username}`, localLang); } catch { /* ignore */ }
  try { localStorage.setItem('vaultedge:lang:default', localLang); } catch (e) { console.warn('failed set default lang', e); }
  onLogin(username);
    } catch (err) {
      if (err?.status === 404) {
        setError('User does not exist');
      } else if (err?.status === 401) {
        setError('Invalid password');
      } else {
        const errorMessage = err?.message || 'An unexpected error occurred. Please try again later.';
        setError(errorMessage);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-600">{t('login.title')}</h2>
          <div>
            <label htmlFor="lang" className="sr-only">Language</label>
            <select
              id="lang"
              value={localLang}
              onChange={(e) => setLocalLang(e.target.value)}
              className="border rounded px-1.5 h-7 text-[11px] leading-none tracking-wide w-28 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {languages.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-red-500 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">{t('login.username')}</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t('login.password')}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>
          <div className="text-right">
            <a href="#" className="text-sm text-blue-600 hover:underline">{t('login.forgotPassword')}</a>
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none"
          >
            {t('login.signIn')}
          </button>
        </form>

        {/* Disclaimer */}
        <p className="mt-6 text-xs text-gray-500 text-center">
          {t('login.disclaimer') || 'Demo environment – do not use real credentials.'}
        </p>

        {/* Registration link */}
        <div className="text-center text-sm text-gray-500 mt-4">
          {t('login.noAccount') || "Don’t have an account?"}{' '}
          <a href="/register" className="text-blue-600 hover:underline">{t('login.register') || 'Register'}</a>
        </div>
      </div>
    </div>
  );
}
