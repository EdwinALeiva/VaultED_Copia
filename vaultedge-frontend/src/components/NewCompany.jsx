// src/components/NewCompany.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Mail } from 'lucide-react';
import VaultIcon from './VaultIcon';

export default function NewCompany() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = () => {
    const trimmed = (name || '').trim();
    const e = (email || '').trim();
  if (!user?.username) return toast.error('Sign in to create a vault');
  if (!trimmed) return toast.error('Enter a vault name');
  if (trimmed.length > 20) return toast.error('Vault name must be 20 characters or fewer');
    if (!e || !e.includes('@')) return toast.error('Enter a notification email');
    try {
      setSubmitting(true);
  const key = `vaultedge:vaults:${user.username}`;
      const raw = localStorage.getItem(key) || '[]';
      const list = JSON.parse(raw) || [];
      const id = `c_${Date.now()}`;
  const rootKey = `vaultedge:rootVault:${user.username}`;
      const parentId = localStorage.getItem(rootKey) || null;
      const nameToStore = trimmed.length > 20 ? trimmed.slice(0, 20) : trimmed;
      const next = [...list, { id, name: nameToStore, createdAt: new Date().toISOString(), notifyEmail: e, parentId }];
      localStorage.setItem(key, JSON.stringify(next));
  localStorage.setItem(`vaultedge:selectedVault:${user.username}`, id);
  try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged')); } catch (ex) { console.warn('dispatch vaultsChanged failed', ex); }
  toast.success('Vault created');
      navigate('/dashboard');
    } catch (err) {
      console.warn(err);
  toast.error('Failed to create vault');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.username) return <div className="p-6">Please sign in to create a vault.</div>;

  return (
    <div className="flex h-screen">
      <div className="w-64 bg-gray-50 border-r p-4">
  <div className="flex items-center gap-2 text-lg font-semibold"><VaultIcon size={20} className="text-gray-700" /> New Vault</div>
      </div>
      <main className="flex-1 p-6">
        <div className="max-w-md ve-card p-4">
          <h1 className="text-xl font-semibold mb-3">Create vault</h1>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700">Vault name</label>
            <input value={name} onChange={(e)=> setName(e.target.value)} className="mt-1 block w-full border rounded p-2" />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700">Notification email</label>
            <input value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="notify@example.com" className="mt-1 block w-full border rounded p-2" />
            <p className="text-xs text-gray-500 mt-1">This email will receive vault-level notifications.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => navigate('/dashboard')} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded">{submitting ? 'Creating…' : 'Create vault'}</button>
          </div>
        </div>
      </main>
    </div>
  );
}
