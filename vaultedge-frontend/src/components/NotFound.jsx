// src/components/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center h-screen flex-col">
  <h1 className="text-4xl font-bold mb-4">{t('notFound.code')}</h1>
  <p className="mb-6">{t('notFound.message')}</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
  {t('notFound.goDashboard')}
      </button>
    </div>
  );
}