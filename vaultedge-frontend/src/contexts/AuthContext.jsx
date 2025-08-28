/* eslint-disable react-refresh/only-export-components */
// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext } from "react";
import { migrateUserToVaultFolders } from '../services/vaultMigration';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (userData) => {
    // Expect userData may lack role; default to 'Owner' for backward compatibility
    setUser({ role: userData.role || 'Owner', ...userData });
    try {
  // Ensure a root/vault for this username exists in localStorage
      const username = userData.username;
      if (username) {
  const companiesKey = `vaultedge:vaults:${username}`;
  const rootKey = `vaultedge:rootVault:${username}`;
  const selectedKey = `vaultedge:selectedVault:${username}`;
        try {
          const raw = localStorage.getItem(companiesKey) || '[]';
          const arr = JSON.parse(raw);
          const companies = Array.isArray(arr) ? arr : [];
          let rootId = localStorage.getItem(rootKey);
          if (!rootId) {
            // Create root vault id for this user
            rootId = `c_root_${username}`;
            // Use a stable display label for the user's root vault; reserve badge metadata for i18n
            const rootName = `Root Vault`;
            const badge = 'parent';
            const ownerUsername = username;
            const notifyEmail = userData.email || '';
            const now = new Date().toISOString();
            // Prepend root vault so it's first in list
            const next = [{ id: rootId, name: rootName, notifyEmail, createdAt: now, parentId: null, badge, ownerUsername }, ...companies];
            localStorage.setItem(companiesKey, JSON.stringify(next));
            localStorage.setItem(rootKey, rootId);
            // set selected vault to root by default
            try { localStorage.setItem(selectedKey, rootId); } catch { /* ignore */ }
            // create demo folder structure mapping for this user (masked ids)
            try { migrateUserToVaultFolders(username); } catch (e) { console.warn('vault folder migration failed', e); }
          } else {
            // ensure selectedCompany exists
            const sel = localStorage.getItem(selectedKey);
            if (!sel) try { localStorage.setItem(selectedKey, rootId); } catch (e) { console.warn('failed set selectedVault', e); }
            // ensure folder structure mapping exists
            try { migrateUserToVaultFolders(username); } catch (e) { console.warn('vault folder migration failed', e); }
          }
        } catch (e) {
          console.warn('failed to ensure root company', e);
        }
      }
    } catch (err) {
      console.warn('error in login side-effects', err);
    }
  };
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}