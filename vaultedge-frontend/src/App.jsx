// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';

import LoginForm from './components/LoginForm';
// Route-based code splitting (reduces main bundle)
const Dashboard = lazy(() => import('./components/Dashboard'));
const SafeBoxDetail = lazy(() => import('./components/SafeBoxDetail'));
const AuditLog = lazy(() => import('./components/AuditLog'));
const NewSafeBox = lazy(() => import('./components/NewSafeBox'));
const NewVault = lazy(() => import('./components/NewVault'));
const NewUser = lazy(() => import('./components/NewUser'));
const Vaults = lazy(() => import('./components/Vaults'));
const UploadFile = lazy(() => import('./components/UploadFile'));
const Support = lazy(() => import('./components/Support'));
const ReportBug = lazy(() => import('./components/ReportBug'));
const GlobalSettings = lazy(() => import('./components/GlobalSettings'));

export default function App() {
  const { user, login } = useAuth(); // Use login instead of setUser
  const navigate = useNavigate();

  const handleLogin = (username) => {
    console.log('User logged in successfully!');
    const u = username || 'demo';
    login({ username: u }); // Use login to set the user
    // Always land on Dashboard after login
    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      <Toaster position="bottom-right" />

      {!user ? (
        <div>
          <h1>Welcome to VaultEdge</h1>
          <LoginForm onLogin={handleLogin} />
        </div>
      ) : (
        <Suspense fallback={<div style={{padding:'2rem', fontSize:'0.875rem'}}>Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/safebox/:id" element={<SafeBoxDetail />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/new-safebox" element={<NewSafeBox />} />
            <Route path="/new-user" element={<NewUser />} />
            <Route path="/new-vault" element={<NewVault />} />
            <Route path="/vaults" element={<Vaults />} />
            <Route path="/upload" element={<UploadFile />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<GlobalSettings />} />
            <Route
              path="/report-bug"
              element={(user && (user.username === 'demo' || user.role === 'admin')) ? <ReportBug /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}
