// src/services/storageApi.js
import { http } from './http';

export const storageApi = {
  ensureUser(userId) {
    return http.post(`/api/storage/users/${encodeURIComponent(userId)}`);
  },
  listSafeBoxes(userId) {
    return http
      .get(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes`)
      .then((r) => (Array.isArray(r.data) ? r.data : []));
  },
  listSafeBoxesUsage(userId) {
    return http
      .get(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/usage`)
      .then(r => Array.isArray(r.data) ? r.data : []);
  },
  fetchAudit(userId, limit = 200) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    return http.get(`/api/storage/users/${encodeURIComponent(userId)}/audit?${params.toString()}`).then(r => Array.isArray(r.data) ? r.data : []);
  },
  fetchAuditSearch(userId, { from, to, scopes = [], safeboxes = [], q = '', page = 0, size = 200 } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (Array.isArray(scopes) && scopes.length) scopes.forEach(s=> params.append('scopes', s));
    if (Array.isArray(safeboxes) && safeboxes.length) safeboxes.forEach(sb=> params.append('safeboxes', sb));
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('size', String(size));
    return http.get(`/api/storage/users/${encodeURIComponent(userId)}/audit/search?${params.toString()}`).then(r => r.data);
  },
  createSafeBox(userId, name) {
    if (typeof name === 'string' && name.length > 64) {
      return Promise.reject(new Error('SafeBox name must be 64 characters or fewer'));
    }
    const params = new URLSearchParams({ name });
    return http.post(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes?${params.toString()}`);
  },
  getTree(userId, safeBoxName) {
    return http.get(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/tree`).then(r => r.data);
  },
  createFolder(userId, safeBoxName, name) {
    const params = new URLSearchParams({ name });
    return http.post(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/folders?${params.toString()}`);
  },
  deleteFolder(userId, safeBoxName, path) {
    const params = new URLSearchParams({ path });
    return http.delete(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/folders?${params.toString()}`);
  },
  renameFolder(userId, safeBoxName, path, newName) {
    const params = new URLSearchParams({ path, newName });
    return http.put(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/folders/rename?${params.toString()}`);
  },
  uploadFile(userId, safeBoxName, relativePath, file, opts = {}) {
    const form = new FormData();
    form.append('path', relativePath);
    form.append('file', file);
    // add client original date (epoch ms) if available from File.lastModified
    if (file && typeof file.lastModified === 'number') {
      form.append('originalDateMs', String(file.lastModified));
    }
  return http.post(
      `/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/files`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
    signal: opts.signal,
        onUploadProgress: (e) => {
          if (opts.onProgress && e.total) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        }
      }
    );
  },
  downloadFile(userId, safeBoxName, relativePath, opts = {}) {
    const params = new URLSearchParams({ path: relativePath });
    return http.get(
      `/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/files?${params.toString()}`,
      {
        responseType: 'blob',
  signal: opts.signal,
        onDownloadProgress: (e) => {
          if (opts.onProgress && e.total) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        }
      }
    );
  },
  deleteFile(userId, safeBoxName, relativePath) {
    const params = new URLSearchParams({ path: relativePath });
    return http.delete(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/files?${params.toString()}`);
  },
  renameFile(userId, safeBoxName, relativePath, newName) {
    const params = new URLSearchParams({ path: relativePath, newName });
    return http.put(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/files/rename?${params.toString()}`);
  },
  downloadZip(userId, safeBoxName, path = '', opts = {}) {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    return http.get(
      `/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/download/zip?${params.toString()}`,
      {
        responseType: 'blob',
  signal: opts.signal,
        onDownloadProgress: (e) => {
          if (opts.onProgress && e.total) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        }
      }
    );
  },
  downloadZipOfFiles(userId, safeBoxName, paths, opts = {}) {
    return http.post(
      `/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/download/zip`,
      { paths },
      {
        responseType: 'blob',
  signal: opts.signal,
        onDownloadProgress: (e) => {
          if (opts.onProgress && e.total) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100));
          }
        }
      }
    );
  }
  ,getRetentionDays(userId, safeBoxName) {
    return http.get(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/settings/retention-days`).then(r=> r.data);
  }
  ,setRetentionDays(userId, safeBoxName, days) {
    const params = new URLSearchParams({ days: String(days) });
    return http.put(`/api/storage/users/${encodeURIComponent(userId)}/safeboxes/${encodeURIComponent(safeBoxName)}/settings/retention-days?${params.toString()}`).then(r=> r.data);
  }
};
