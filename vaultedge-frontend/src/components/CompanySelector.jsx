// src/components/CompanySelector.jsx
import React, { useEffect, useState } from 'react';
// removed inline building icon; Dashboard shows the shared icon
import { useNavigate } from 'react-router-dom';
// toast not needed here; creation moved to dedicated page
import { useAuth } from '../contexts/AuthContext';
import CustomSelect from './CustomSelect';

const companiesKey = (username) => `vaultedge:vaults:${username}`;
export default function CompanySelector({ onChange } = {}) {
  const { user } = useAuth();
  const username = user?.username;
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState('default');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    try {
      const raw = localStorage.getItem(companiesKey(username)) || '[]';
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
  // ensure parent (root) vault appears first
      list.sort((a, b) => {
        if (a.badge === 'parent') return -1;
        if (b.badge === 'parent') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setCompanies(list);
  const pref = localStorage.getItem(`vaultedge:selectedVault:${username}`);
      if (pref) setSelected(pref); else setSelected(list && list[0] ? list[0].id : 'default');
    } catch {
      setError('Failed to load companies');
      setCompanies([]);
      setSelected('default');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    const handler = () => {
      try { const c = JSON.parse(localStorage.getItem(companiesKey(username)) || '[]'); setCompanies(Array.isArray(c)?c:[]); } catch { setCompanies([]); }
    };
  window.addEventListener('vaultedge:vaultsChanged', handler);
  return () => window.removeEventListener('vaultedge:vaultsChanged', handler);
  }, [username]);

  // persist helper intentionally removed; creation managed on /new-company

  const handleSelect = (e) => {
    const v = e.target.value;
    setSelected(v);
  if (username) localStorage.setItem(`vaultedge:selectedVault:${username}`, v);
    if (onChange) onChange(v);
  };

  // Company creation handled on the dedicated /new-company page

  if (!username) return null;

  // Accessibility: label and keyboard-focusable select
  return (
    <div className="flex items-center gap-2">
  <label htmlFor="companySelector" className="sr-only">Select vault</label>
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="text-sm text-gray-600">Loading companies…</div>
  ) : companies && companies.length ? (
            <CustomSelect
              id="companySelector"
              name="company"
              value={selected}
              onChange={(v) => handleSelect({ target: { value: v } })}
              options={companies.map(c => ({
                code: c.id,
                // remove arrow prefix from dropdown names; show readable name
                name: c.badge === 'parent' ? 'Root Vault' : ((c.name||'').length > 20 ? (c.name||'').slice(0,20) + '…' : c.name),
                badge: c.badge,
                parentId: c.parentId
              }))}
              addDefaultOption="N"
              className="p-0"
            />
        ) : (
          <button className="px-3 py-1 text-sm border rounded" onClick={() => navigate('/new-company')}>Create vault</button>
        )}
      </div>

  {/* Creation moved to dedicated page */}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
