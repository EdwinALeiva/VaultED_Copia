// src/components/UploadFile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import { mockApi } from '../services/mockApi';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import CustomSelect from './CustomSelect';
import { useI18n } from '../contexts/I18nContext';

/**
 * UploadFile Component
 * --------------------
 * Renders a form that lets the user select an existing SafeBox
 * from a dropdown, enter a file name, and upload it to that box.
 * Uses mockApi.addFile to simulate the upload, then navigates
 * to the SafeBox detail screen.
 */
export default function UploadFile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  // State to hold the list of SafeBoxes and the selected box
  const [boxes, setBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState('');

  // State for the file name input
  const [fileName, setFileName] = useState('');

  // On mount, load all SafeBoxes for the dropdown
  useEffect(() => {
    mockApi.getSafeBoxes().then((data) => {
      setBoxes(data);
      // Default to the first box if available
      if (data.length > 0) setSelectedBoxId(data[0].id);
    });
  }, []);

  /**
   * Handle form submission:
   * - Validate inputs
   * - Call mockApi.addFile to simulate the upload
   * - Show toast notification
   * - Redirect to the selected SafeBox detail page
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedBoxId) {
  toast.error(t('upload.error.noSafebox'));
      return;
    }
    if (!fileName.trim()) {
  toast.error(t('upload.error.noFileName'));
      return;
    }

    // Simulate file upload
    mockApi
      .addFile(Number(selectedBoxId), {
        name: fileName.trim(),
        size: '1 KB', // demo size
        uploadedAt: new Date().toISOString().split('T')[0],
        accessPolicy: 'Dual Key',
      })
      .then((newFile) => {
  toast.success(t('upload.success',{name:newFile.name, boxId:selectedBoxId}));
        // Navigate to the SafeBox detail screen
        navigate(`/safebox/${selectedBoxId}`);
      })
      .catch((err) => {
        console.error('Upload failed:', err);
  toast.error(t('upload.error.failed'));
      });
  };

  return (
    <div className="flex h-screen">
      {/* Left sidebar */}
      <SideMenu />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top navigation bar with logout */}
        <TopNav user={user} onLogout={logout} />

        {/* Form area */}
        <main className="p-6 overflow-auto">
          <h1 className="text-2xl font-semibold mb-4">{t('upload.title')}</h1>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            {/* Dropdown to choose SafeBox */}
            <div>
              <CustomSelect
                label={t('upload.selectSafebox')}
                name="selectedBox"
                value={selectedBoxId}
                onChange={(v) => setSelectedBoxId(v)}
                options={boxes.map(b => ({ code: String(b.id), name: `${b.name} (#${b.id})` }))}
                addDefaultOption="N"
              />
            </div>

            {/* File name input */}
            <div>
              <label htmlFor="file-name" className="block text-sm font-medium text-gray-700">
                {t('upload.fileName')}
              </label>
              <input
                id="file-name"
                type="text"
                required
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={t('upload.fileName.placeholder')}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {t('upload.button')}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
