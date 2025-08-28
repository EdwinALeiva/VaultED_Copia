// src/components/SafeBoxDetail.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import FileTree from './FileTree';
import { storageApi } from '../services/storageApi';
import { emailService } from '../services/emailService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Download, RefreshCcw, KeySquare, Trash2, Settings2, Mail, Save as SaveIcon, X, Info, Shield, FolderPlus, Upload, Building } from 'lucide-react';
import { getIdForNameOccurrence } from '../services/safeboxRegistry';
import { useI18n } from '../contexts/I18nContext';

export default function SafeBoxDetail() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { id } = useParams();
  const safeBoxName = decodeURIComponent(id);
  

  // Tree and folder selection
  const [tree, setTree] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);

  // Files and selection
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());

  // Loading and activity
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState({ active: false, label: '', percent: null });
  const activityAbortRef = useRef(null);

  // Hidden inputs
  const fileInputRef = useRef(null);
  const importFolderInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const bulkReplaceInputRef = useRef(null);

  // Upload / replace flows
  const [pendingUploads, setPendingUploads] = useState([]);
  const [pendingReplace, setPendingReplace] = useState(null);
  const [pendingBulkReplace, setPendingBulkReplace] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);

  // Import flow (folder)
  const [pendingImport, setPendingImport] = useState(null);
  const [importConflictModal, setImportConflictModal] = useState(null); // legacy batch modal (kept for non-per-file fallback)
  const conflictDecisionRef = useRef({ action: null, applyAll: false });

  // Per-file conflict modal state for Import
  const [singleImportConflict, setSingleImportConflict] = useState(null); // { path }
  const [singleImportApplyAll, setSingleImportApplyAll] = useState(false);
  const importConflictResolverRef = useRef(null); // resolves to 'replace' | 'keep-both' | 'skip' | 'cancel'

  // Rename
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState('');

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Folder modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderConfirm, setShowNewFolderConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);

  // Drawer / preview
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('Preview');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Session log and stats for email summaries
  const [sessionLog, setSessionLog] = useState([]);
  const sessionStartRef = useRef(new Date());
  // Keep a lightweight reference to sessionLog so ESLint doesn't flag it as unused
  React.useEffect(() => { void sessionLog; }, [sessionLog]);
  const folderStatsRef = useRef(new Map());
  const setFolderStats = (updater) => {
    const next = updater(folderStatsRef.current || new Map());
    folderStatsRef.current = next;
  };

  // Box settings drawer and prefs
  const [boxSettingsOpen, setBoxSettingsOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [emailSummaryPref, setEmailSummaryPref] = useState('per-session');
  const [rememberLastView, setRememberLastView] = useState(true);
  const restoreAttemptedRef = useRef(false);

  // Box metadata + capacity
  const [boxMeta, setBoxMeta] = useState({ createdAt: '', boxType: 'Personal', securityKeys: 1 });
  const [capacityBytes, setCapacityBytes] = useState(0);
  const [capacityKnown, setCapacityKnown] = useState(false);

  // Helpers
  const hashString = (s = '') => {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  };
  const pickPolicyKeys = useCallback(() => boxMeta.securityKeys || 1, [boxMeta.securityKeys]);
  const hasAuthorizedSecondary = useMemo(() => {
    if (!user?.username || !safeBoxName) return false;
    return localStorage.getItem(`safeboxSecondary:${user.username}:${safeBoxName}`) === '1';
  }, [user?.username, safeBoxName]);

  // Init preferences for this safebox
  useEffect(() => {
    if (!user?.username || !safeBoxName) return;
  // resolve registry id for this safebox name (first occurrence)
  const sbId = getIdForNameOccurrence(user.username, safeBoxName, 0) || safeBoxName;
  const k = `safeboxOwnerEmail:${user.username}:${sbId}`;
    const v = localStorage.getItem(k);
    if (v) setOwnerEmail(v);
  const prefKey = `safeboxEmailSummaryPref:${user.username}:${sbId}`;
  const prefVal = localStorage.getItem(prefKey);
    if (prefVal) setEmailSummaryPref(prefVal);
  const rKey = `safeboxRememberLastView:${user.username}:${sbId}`;
  const rVal = localStorage.getItem(rKey);
    if (rVal != null) setRememberLastView(rVal === '1');
  localStorage.setItem(`lastSafebox:${user.username}`, sbId);
  }, [user?.username, safeBoxName]);

  // Settings drawer open event
  useEffect(() => {
    const handler = () => setBoxSettingsOpen(true);
    window.addEventListener('vaultedge:openBoxSettings', handler);
    return () => window.removeEventListener('vaultedge:openBoxSettings', handler);
  }, []);

  // Logout listener to email summary on logout when selected
  useEffect(() => {
    const onLogout = () => {
      if (!user?.username || !safeBoxName) return;
      const pref = localStorage.getItem(`safeboxEmailSummaryPref:${user.username}:${safeBoxName}`) || emailSummaryPref;
      if (pref !== 'on-logout') return;
      const start = sessionStartRef.current?.toISOString();
      const end = new Date().toISOString();
      const stats = folderStatsRef.current || new Map();
      const perFolder = Array.from(stats.entries()).map(([folder, v]) => ({ folder, ...v }));
      const owner = localStorage.getItem(`safeboxOwnerEmail:${user.username}:${safeBoxName}`);
      const recipients = [];
      if (owner && owner.includes('@')) recipients.push(owner);
      if (localStorage.getItem(`safeboxSecondary:${user.username}:${safeBoxName}`) === '1') {
        recipients.push(`${user.username}+authorized@example.com`);
      }
      if (recipients.length && perFolder.length) {
        emailService.sendSessionSummary(user, safeBoxName, recipients, { startedAt: start, endedAt: end, perFolder });
      }
    };
    window.addEventListener('vaultedge:logout', onLogout);
    return () => window.removeEventListener('vaultedge:logout', onLogout);
  }, [user, safeBoxName, emailSummaryPref]);

  // Removed tab-close persistence by request

  // Expose a simple toggle (placeholder UI could be added later) - for now function only

  // Initialize safebox metadata once per safebox (persist to localStorage for consistency)
  useEffect(() => {
  if (!user?.username || !safeBoxName) return;
  const sbId = getIdForNameOccurrence(user.username, safeBoxName, 0) || safeBoxName;
  const k = `safeboxMeta:${user.username}:${sbId}`;
    const existing = localStorage.getItem(k);
    if (existing) {
      try { 
        const meta = JSON.parse(existing);
        setBoxMeta(meta);
        if (meta && typeof meta.capacityBytes === 'number' && meta.capacityBytes > 0) {
          setCapacityBytes(meta.capacityBytes);
          setCapacityKnown(true);
        }
        return; 
      } catch {
        // ignore malformed stored metadata
      }
    }
    // Create pseudo-random metadata
  const now = Date.now();
  const daysBack = (hashString(safeBoxName) % 365) + 1;
    const createdAt = new Date(now - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const boxType = hashString(safeBoxName + 'type') % 2 === 0 ? 'Personal' : 'Business';
    const securityKeys = hashString(safeBoxName + 'sec') % 2 === 0 ? 1 : 2;
    const meta = { createdAt, boxType, securityKeys };
  localStorage.setItem(k, JSON.stringify(meta));
    setBoxMeta(meta);
  }, [user?.username, safeBoxName]);

  // Load capacity from backend usage if not set via local meta
  useEffect(() => {
    if (!user?.username || !safeBoxName) return;
    if (capacityKnown) return;
    let cancelled = false;
    (async () => {
      try {
        const usage = await storageApi.listSafeBoxesUsage(user.username);
        const info = Array.isArray(usage) ? usage.find(u => u.safeBoxName === safeBoxName) : null;
        const cap = info && typeof info.capacityBytes === 'number' ? info.capacityBytes : 0;
        if (!cancelled && cap > 0) {
          setCapacityBytes(cap);
          setCapacityKnown(true);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.username, safeBoxName, capacityKnown]);

  // Context menu handlers
  const onContextMenuFolder = useCallback((folder, e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folder });
  }, []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && setContextMenu(null);
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Helper: find node by path
  const findNodeByPath = useCallback((node, path) => {
    if (!node) return null;
    if ((node.path || '') === (path || '')) return node;
    if (!node.children) return null;
    for (const child of node.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
    return null;
  }, []);

  // Delete selected files (backend) as memoized handler (used by confirmAndDelete)
  const handleDelete = useCallback(async () => {
    const toDelete = files.filter((f) => selected.has(f.id));
    if (toDelete.length === 0) return;
    try {
      let idx = 0;
      for (const f of toDelete) {
        idx++;
        setActivity({ active: true, label: `Deleting ${f.name} (${idx}/${toDelete.length})`, percent: Math.round(((idx-1) / toDelete.length) * 100) });
        try {
          await storageApi.deleteFile(
            user.username,
            safeBoxName,
            f.path || (currentFolder?.path ? `${currentFolder.path}/${f.name}` : f.name)
          );
        } catch (err) {
          const reason = err?.response?.headers?.['x-error-reason'] || err?.response?.data || err.message || 'Unknown reason';
          throw new Error(`Failed deleting ${f.name}: ${reason}`);
        }
        setActivity({ active: true, label: `Deleting ${f.name} (${idx}/${toDelete.length})`, percent: Math.round((idx / toDelete.length) * 100) });
      }
  toast.success(t('safeBoxDetail.toasts.filesDeleted', { count: toDelete.length }));
      // update session stats for deletions
      const tsDel = new Date().toISOString();
      setSessionLog(prev => [...prev, ...toDelete.map(f => ({ ts: tsDel, action: 'DELETE_FILE', path: f.path || (currentFolder?.path ? `${currentFolder.path}/${f.name}` : f.name) }))]);
      setFolderStats(prev => {
        const m = new Map(prev);
        const key = currentFolder?.path || '';
        const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
        cur.deleted += toDelete.length;
        m.set(key, cur);
        return m;
      });
      const root = await storageApi.getTree(user.username, safeBoxName);
  const rootNode = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
      setTree([rootNode]);
      setCurrentFolder(findNodeByPath(rootNode, currentFolder?.path || '') || rootNode);
      setSelected(new Set());
    } catch {
      // no longer persisting error banner
      toast.error(t('safeBoxDetail.toasts.deleteFailed'));
    }
      setActivity({ active: false, label: '', percent: null });
  }, [files, selected, user?.username, safeBoxName, currentFolder?.path, findNodeByPath, t]);

  // Load the folder tree when the component mounts
  useEffect(() => {
    if (!user?.username || !safeBoxName) return;
    setLoading(true);
    storageApi.getTree(user.username, safeBoxName)
      .then((root) => {
  const rootNode = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
        setTree([rootNode]);
        setCurrentFolder(rootNode);
      })
      .catch(() => {
        setTree([]);
        setCurrentFolder(null);
      })
      .finally(() => setLoading(false));
  }, [user, safeBoxName]);

  // Update visible files when folder changes
  useEffect(() => {
    if (currentFolder) {
      setFiles(currentFolder.children.filter((n) => n.type === 'file'));
      setSelected(new Set());
    }
  }, [currentFolder]);

  // Update file metadata to include creation date, modification date, user, and a stable id
  const enrichFileMetadata = useCallback(
    (file) => ({
      id: file.path || file.name,
      ...file,
      size: typeof file.size === 'number' ? file.size : (Number(file.size) || 0),
      uploadedAt: file.uploadedAt || new Date().toISOString(),
      accessPolicy: file.accessPolicy || 'Dual Key',
      createdAt: file.createdAt || null,
      modifiedAt: file.modifiedAt || null,
      originalDate: file.originalDate || null,
      policyKeys: pickPolicyKeys(file.path || file.name),
      user: (user && user.username) || 'Unknown',
    }),
    [user, pickPolicyKeys]
  );

  // Remove redundant effect; rely on the enriched mapping below to set files and reset selection
  // useEffect(() => {
  //   if (currentFolder) {
  //     setFiles(currentFolder.children.filter((n) => n.type === 'file'));
  //     setSelected(new Set());
  //   }
  // }, [currentFolder]);

  // Update files with enriched metadata
  useEffect(() => {
    if (currentFolder) {
      setFiles(
        currentFolder.children
          .filter((n) => n.type === 'file')
          .map(enrichFileMetadata)
      );
      setSelected(new Set());
    }
  }, [currentFolder, enrichFileMetadata]);

  // Persist last view per safebox (only when enabled and after restore attempt)
  useEffect(() => {
    if (!user?.username || !safeBoxName || !rememberLastView) return;
    if (!restoreAttemptedRef.current) return; // wait until restore flow ran once
    const k = `safeboxLastView:${user.username}:${safeBoxName}`;
    const data = { folder: currentFolder?.path || '' };
    localStorage.setItem(k, JSON.stringify(data));
  }, [user?.username, safeBoxName, currentFolder?.path, rememberLastView]);
  useEffect(() => {
    if (!user?.username || !safeBoxName || !rememberLastView) return;
    const k = `safeboxLastView:${user.username}:${safeBoxName}`;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.folder !== 'string') return;
      // After tree loads, navigate to stored folder
      const t = setTimeout(() => {
        if (tree[0]) {
          const node = findNodeByPath(tree[0], parsed.folder);
          if (node) setCurrentFolder(node);
        }
      }, 0);
      return () => clearTimeout(t);
    } catch { /* ignore */ }
    finally {
      // Mark that we attempted restore so subsequent folder changes can be saved
      restoreAttemptedRef.current = true;
    }
  }, [tree, user?.username, safeBoxName, findNodeByPath, rememberLastView]);

  // Persist rememberLastView setting itself
  useEffect(() => {
    if (!user?.username || !safeBoxName) return;
    const rKey = `safeboxRememberLastView:${user.username}:${safeBoxName}`;
    localStorage.setItem(rKey, rememberLastView ? '1' : '0');
    if (!rememberLastView) {
      // Clear previously stored folder when disabling to avoid surprises
      const k = `safeboxLastView:${user.username}:${safeBoxName}`;
      localStorage.removeItem(k);
    }
  }, [rememberLastView, user?.username, safeBoxName]);

  // Displayed files (no more Saved Views block)
  const displayedFiles = files;

  // Toggle selection for a file
  const toggleSelect = (fileId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  // Select/deselect all files in folder via header checkbox only
  const selectAll = () => {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map((f) => f.id)));
  };

  // Replace simulated add with real upload (any file type)
  const handleUploadClick = () => fileInputRef.current && fileInputRef.current.click();

  const handleFilesSelected = (e) => {
    const filesToUpload = Array.from(e.target.files || []);
    if (!filesToUpload.length || !currentFolder) return;
    setPendingUploads(filesToUpload);
  };

  const listExistingFileNames = useCallback(() => new Set((currentFolder?.children || []).filter(n => n.type === 'file').map(n => n.name)), [currentFolder?.children]);

  const uniqueName = useCallback((original, existing) => {
    const dot = original.lastIndexOf('.');
    const base = dot > 0 ? original.slice(0, dot) : original;
    const ext = dot > 0 ? original.slice(dot) : '';
    let i = 2; // start at (2)
    let candidate = `${base} (${i})${ext}`;
    while (existing.has(candidate)) { i++; candidate = `${base} (${i})${ext}`; }
    return candidate;
  }, []);

  // Rename helpers
  const requestRenameFolder = useCallback((folderNode) => {
    if (!folderNode) return;
    // do not allow renaming safebox root
    if (!folderNode.path) {
  toast.error(t('safeBoxDetail.toasts.cannotRenameRoot'));
      return;
    }
    const parentPath = folderNode.path && folderNode.path.includes('/') ? folderNode.path.slice(0, folderNode.path.lastIndexOf('/')) : '';
    setRenameTarget({ type:'folder', path: folderNode.path, currentName: folderNode.name, parentPath });
    setRenameName(folderNode.name);
  }, [t]);

  const requestRenameFile = useCallback((fileNode) => {
    const parentPath = fileNode.path && fileNode.path.includes('/') ? fileNode.path.slice(0, fileNode.path.lastIndexOf('/')) : '';
    setRenameTarget({ type:'file', path: fileNode.path, currentName: fileNode.name, parentPath });
    setRenameName(fileNode.name);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renameTarget || !user?.username || !safeBoxName) return;
    const newName = (renameName || '').trim();
  if (!newName || newName === renameTarget.currentName) { setRenameTarget(null); return; }
  if (newName.includes('/') || newName.includes('\\')) { toast.error('Name cannot contain "/" or "\\"'); return; }
  if (newName === '.' || newName === '..') { toast.error('Invalid name'); return; }
    if (renameTarget.type === 'folder') {
      const parent = renameTarget.parentPath;
      const rootNode = tree[0];
      const parentNode = findNodeByPath(rootNode, parent);
      if (parentNode && parentNode.children?.some(n => n.type === 'folder' && n.name.toLowerCase() === newName.toLowerCase())) {
  toast.error(t('safeBoxDetail.toasts.folderExists'));
        return;
      }
      try {
        await storageApi.renameFolder(user.username, safeBoxName, renameTarget.path, newName);
  toast.success(t('safeBoxDetail.toasts.folderRenamed'));
        setSessionLog(prev => [...prev, { ts: new Date().toISOString(), action:'RENAME_FOLDER', path: renameTarget.path + ' -> ' + (renameTarget.parentPath ? renameTarget.parentPath + '/' : '') + newName }]);
        const root = await storageApi.getTree(user.username, safeBoxName);
  const newRoot = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
        setTree([newRoot]);
        const newPath = renameTarget.path.replace(/[^/]+$/, newName);
        setCurrentFolder(findNodeByPath(newRoot, currentFolder?.path === renameTarget.path ? newPath : currentFolder?.path || '') || newRoot);
      } catch (e) {
  toast.error(e?.response?.data || e.message || t('safeBoxDetail.toasts.renameFailed'));
      } finally {
        setRenameTarget(null);
      }
    } else {
      const parent = renameTarget.parentPath;
      const rootNode = tree[0];
      const parentNode = findNodeByPath(rootNode, parent);
      if (parentNode && parentNode.children?.some(n => n.type === 'file' && n.name.toLowerCase() === newName.toLowerCase())) {
  toast.error(t('safeBoxDetail.toasts.fileExists'));
        return;
      }
      try {
        await storageApi.renameFile(user.username, safeBoxName, renameTarget.path, newName);
  toast.success(t('safeBoxDetail.toasts.fileRenamed'));
        setSessionLog(prev => [...prev, { ts: new Date().toISOString(), action:'UPDATE_FILE', path: renameTarget.path + ' -> ' + (renameTarget.parentPath ? renameTarget.parentPath + '/' : '') + newName }]);
        setFolderStats(prev => {
          const m = new Map(prev);
          const key = parent || '';
          const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
          cur.updated += 1;
          m.set(key, cur);
          return m;
        });
        const root = await storageApi.getTree(user.username, safeBoxName);
  const newRoot = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
        setTree([newRoot]);
        setCurrentFolder(findNodeByPath(newRoot, currentFolder?.path || '') || newRoot);
      } catch (e) {
  toast.error(e?.response?.data || e.message || t('safeBoxDetail.toasts.renameFailed'));
      } finally {
        setRenameTarget(null);
      }
    }
  }, [renameTarget, renameName, user?.username, safeBoxName, tree, currentFolder?.path, findNodeByPath, t]);

  const [conflictModal, setConflictModal] = useState(null);
  const confirmUploadNow = async () => {
    const filesToUpload = pendingUploads;
    if (!filesToUpload.length || !currentFolder) { setPendingUploads([]); return; }
    // Analyze conflicts
    const existingNames = listExistingFileNames();
    const conflicting = filesToUpload.filter(f => existingNames.has(f.name)).map(f => f.name);
    if (conflicting.length > 0 && !conflictDecisionRef.current.action) {
      setConflictModal({ names: conflicting });
      return; // wait for user decision
    }
    try {
      // Capacity pre-check before starting uploads
      const decision = conflictDecisionRef.current.action || 'replace';
      const nameToSize = new Map((currentFolder?.children || []).filter(n => n.type === 'file').map(n => [n.name, Number(n.size) || 0]));
      let delta = 0;
      for (const f of filesToUpload) {
        const exists = nameToSize.has(f.name);
        if (exists) {
          if (decision === 'skip') continue;
          if (decision === 'replace') {
            const old = nameToSize.get(f.name) || 0;
            if (f.size > old) delta += (f.size - old);
          } else if (decision === 'keep-both') {
            delta += f.size;
          }
        } else {
          delta += f.size;
        }
      }
      const capOk = ensureCapacityForDelta(delta);
      if (!capOk.ok) return;
      let index = 0;
      let replaced = 0, skipped = 0, keptBoth = 0;
      for (const f of filesToUpload) {
        index++;
        let targetName = f.name;
        const fileConflicts = existingNames.has(f.name);
        if (fileConflicts) {
          if (decision === 'skip') { skipped++; continue; }
          if (decision === 'keep-both') { targetName = uniqueName(f.name, existingNames); keptBoth++; existingNames.add(targetName); }
          else { replaced++; }
        } else {
          existingNames.add(targetName);
        }
        setActivity({ active: true, label: `Uploading ${targetName} (${index}/${filesToUpload.length})`, percent: 0 });
        const rel = currentFolder.path ? `${currentFolder.path}/${targetName}` : targetName;
        // Setup cancellable upload
        const controller = new AbortController();
        activityAbortRef.current = controller;
        await storageApi.uploadFile(user.username, safeBoxName, rel, f, {
          signal: controller.signal,
          onProgress: (p) => setActivity({ active: true, label: `Uploading ${f.name} (${index}/${filesToUpload.length})`, percent: p })
        });
  // removed mint highlight
      }
      const uploaded = filesToUpload.length - skipped;
  toast.success(`Uploaded ${uploaded} file(s) ${replaced?`• replaced ${replaced} `:''}${keptBoth?`• kept both ${keptBoth} `:''}${skipped?`• skipped ${skipped} `:''}`.trim()); // TODO: add i18n summary key
  // already logging per file above
      // log + stats per file
      const basePath = currentFolder.path || '';
      const now = new Date().toISOString();
      const newLogs = filesToUpload.map(f => ({ ts: now, action: 'ADD_FILE', path: (basePath ? `${basePath}/${f.name}` : f.name) }));
      setSessionLog(prev => [...prev, ...newLogs]);
      setFolderStats(prev => {
        const m = new Map(prev);
        const key = basePath;
        const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
        cur.added += filesToUpload.length;
        m.set(key, cur);
        return m;
      });
      const root = await storageApi.getTree(user.username, safeBoxName);
  const rootNode = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
  setTree([rootNode]);
  setCurrentFolder(findNodeByPath(rootNode, currentFolder.path || '') || rootNode);
    } catch {
      toast.error(t('safeBoxDetail.toasts.uploadFailed'));
    } finally {
  setActivity({ active: false, label: '', percent: null });
  activityAbortRef.current = null;
      // reset input so same file can be picked again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPendingUploads([]);
      setConflictModal(null);
      conflictDecisionRef.current = { action: null, applyAll: false };
    }
  };

  // removed previewSummary; replaced with print session log

  // ✅ NEW: Download a single file from backend
  const handleDownload = async (file) => {
    try {
      const rel = file.path || (currentFolder?.path ? `${currentFolder.path}/${file.name}` : file.name);
      setActivity({ active: true, label: `Downloading ${file.name}`, percent: 0 });
  const controller = new AbortController();
  activityAbortRef.current = controller;
  const resp = await storageApi.downloadFile(user.username, safeBoxName, rel, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Downloading ${file.name}`, percent: p }) });
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      await saveBlob(blob, file.name);
    } catch {
  toast.error(t('safeBoxDetail.toasts.downloadFailed'));
    } finally {
  setActivity({ active: false, label: '', percent: null });
  activityAbortRef.current = null;
    }
  };

  // Open drawer on row click (except clicking direct action icons)
  const openDrawerFor = async (file) => {
    setPreviewFile(file);
    setDrawerOpen(true);
    setDrawerTab('Preview');
    // Fetch a small blob for preview if not too large (skip if > 20MB)
    try {
      if (file.size != null && file.size > 20 * 1024 * 1024) return; // too big
      const rel = file.path || (currentFolder?.path ? `${currentFolder.path}/${file.name}` : file.name);
      const resp = await storageApi.downloadFile(user.username, safeBoxName, rel);
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch { /* ignore preview failures */ }
  };

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Replace (update) an existing file: must match same name
  const handleReplace = (file) => {
    setReplaceTarget(file);
    // Defer the click to ensure it's within the same user gesture but after state update
    setTimeout(() => {
      if (replaceInputRef.current) replaceInputRef.current.click();
    }, 0);
  };

  const handleReplaceSelected = (e) => {
    const picked = e.target.files && e.target.files[0];
    if (!picked || !replaceTarget || !currentFolder) {
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }
    if (picked.name !== replaceTarget.name) {
      toast.error('Selected file name must match the existing file name to update.');
      replaceInputRef.current.value = '';
      return;
    }
    setPendingReplace({ file: picked, target: replaceTarget });
  };

  const confirmReplaceNow = async () => {
    if (!pendingReplace || !currentFolder) return;
    const { file: picked, target } = pendingReplace;
    try {
  // Capacity pre-check for replacement growth
  const old = (target && typeof target.size === 'number') ? target.size : 0;
  const delta = Math.max(0, (picked?.size || 0) - old);
  const capOk = ensureCapacityForDelta(delta);
  if (!capOk.ok) return;
  const rel = target.path || (currentFolder.path ? `${currentFolder.path}/${target.name}` : target.name);
  setActivity({ active: true, label: `Updating ${target.name}`, percent: 0 });
  // Make replace cancellable
  const controller = new AbortController();
  activityAbortRef.current = controller;
  await storageApi.uploadFile(user.username, safeBoxName, rel, picked, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Updating ${target.name}`, percent: p }) });
      toast.success(`Updated ${target.name}`);
  // removed mint highlight
  // stats updated below
      const now2 = new Date().toISOString();
      setSessionLog(prev => [...prev, { ts: now2, action: 'UPDATE_FILE', path: rel }]);
      setFolderStats(prev => {
        const m = new Map(prev);
        const key = currentFolder.path || '';
        const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
        cur.updated += 1;
        m.set(key, cur);
        return m;
      });
      const root = await storageApi.getTree(user.username, safeBoxName);
      const rootNode = { ...root, id: `${safeBoxName}-root` };
      setTree([rootNode]);
      setCurrentFolder(findNodeByPath(rootNode, currentFolder.path || '') || rootNode);
      setReplaceTarget(null);
    } catch {
      toast.error(t('safeBoxDetail.toasts.updateFailed'));
    } finally {
      setActivity({ active: false, label: '', percent: null });
      activityAbortRef.current = null;
      setPendingReplace(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // File System Access API helper (Save As dialog) and fallback
  const saveWithPicker = useCallback(async (suggestedName, blob) => {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'All Files', accept: { '*/*': ['.*'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const saveBlob = useCallback(async (blob, fileName) => {
    const usedPicker = await saveWithPicker(fileName, blob);
    if (usedPicker) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [saveWithPicker]);

  // ZIP download helpers
  const downloadDirectory = async (folder) => {
  if (!folder) return toast.error(t('safeBoxDetail.context.newFolder')); // fallback minimal
    try {
      const rel = folder.path || '';
      setActivity({ active: true, label: `Downloading folder ${folder.name}`, percent: 0 });
  const controller = new AbortController();
  activityAbortRef.current = controller;
  const resp = await storageApi.downloadZip(user.username, safeBoxName, rel, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Downloading folder ${folder.name}`, percent: p }) });
      const name = (folder.path ? folder.name : safeBoxName) + '.zip';
      await saveBlob(new Blob([resp.data]), name);
    } catch {
  toast.error(t('safeBoxDetail.toasts.folderDownloadFailed'));
    } finally {
  setActivity({ active: false, label: '', percent: null });
  activityAbortRef.current = null;
    }
  };

  // Removed: downloadTree (consolidated to a single "Download current folder" control)

  // Breadcrumbs
  const breadcrumbs = (() => {
    const parts = (currentFolder?.path || '').split('/').filter(Boolean);
    const crumbs = [{ label: safeBoxName, path: '' }];
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({ label: p, path: acc });
    }
    return crumbs;
  })();

  const goToCrumb = (p) => {
    const node = findNodeByPath(tree[0], p);
    if (node) setCurrentFolder(node);
  };

  // Confirm delete UX
  const confirmAndDelete = useCallback(() => {
    if (selected.size === 0) return;
    setConfirmDelete(true);
  }, [selected]);

  // Download selected as ZIP (include saveBlob in deps)
  const handleDownloadSelected = useCallback(async () => {
    const selectedFiles = files.filter((f) => selected.has(f.id));
    if (selectedFiles.length === 0) return;
    try {
      const paths = selectedFiles.map((f) => f.path || (currentFolder?.path ? `${currentFolder.path}/${f.name}` : f.name));
      setActivity({ active: true, label: `Downloading ${selectedFiles.length} file(s)`, percent: 0 });
  const controller = new AbortController();
  activityAbortRef.current = controller;
  const resp = await storageApi.downloadZipOfFiles(user.username, safeBoxName, paths, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Downloading ${selectedFiles.length} file(s)`, percent: p }) });
      await saveBlob(new Blob([resp.data]), `${safeBoxName}-selection.zip`);
    } catch {
      toast.error(t('safeBoxDetail.toasts.downloadFailed'));
    } finally {
  setActivity({ active: false, label: '', percent: null });
  activityAbortRef.current = null;
    }
  }, [files, selected, currentFolder, user?.username, safeBoxName, saveBlob, t]);

  // ===== Capacity helpers =====
  const computeTotalUsedBytes = useCallback((node) => {
    if (!node) return 0;
    let total = 0;
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.type === 'file' && typeof n.size === 'number') total += n.size;
      if (Array.isArray(n.children)) for (const ch of n.children) stack.push(ch);
    }
    return total;
  }, []);
  const getTotalUsedBytes = useCallback(() => {
    const root = tree && tree[0];
    return root ? computeTotalUsedBytes(root) : 0;
  }, [tree, computeTotalUsedBytes]);
  const ensureCapacityForDelta = useCallback((deltaBytes) => {
    // If capacity unknown, allow upload (can't validate)
    if (!capacityKnown || capacityBytes <= 0) return { ok: true };
    const used = getTotalUsedBytes();
    const projected = used + Math.max(0, deltaBytes || 0);
    if (projected <= capacityBytes) return { ok: true };
    const need = projected - capacityBytes;
    toast.error(`Not enough space. Need ${fmtBytes(need)} more. Used ${fmtBytes(used)} of ${fmtBytes(capacityBytes)}.`);
    return { ok: false };
  }, [capacityKnown, capacityBytes, getTotalUsedBytes]);

  // Drag & drop upload
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = async (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!dropped.length || !currentFolder) return;
    // Use the same confirmation + conflict flow as file picker
    setPendingUploads(dropped);
  };

  // Folder import helpers
  // Fallback to File System Access API when available (supports empty folders)
  const gatherDirFiles = useCallback(async (dirHandle, prefix = '') => {
    const out = [];
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          // emulate webkitRelativePath for downstream logic
          try { Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}${entry.name}`, configurable: true }); } catch { /* ignore defineProperty failures */ }
          out.push(file);
        } else if (entry.kind === 'directory') {
          const nested = await gatherDirFiles(entry, `${prefix}${entry.name}/`);
          out.push(...nested);
        }
      }
    } catch { /* ignore directory iteration errors */ }
    return out;
  }, []);
  const handleImportFolderClick = async () => {
    // reset input value so choosing the same folder triggers change
    if (importFolderInputRef.current) importFolderInputRef.current.value = '';
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dir = await window.showDirectoryPicker();
        const files = await gatherDirFiles(dir);
        const top = dir?.name || 'Imported';
        setPendingImport({ files, folderName: top, parentPath: currentFolder?.path || '', includeSubfolders: true });
        return;
  } catch {
        // user canceled; fall back to input picker below
      }
    }
    if (importFolderInputRef.current) importFolderInputRef.current.click();
  };
  // removed parentOfPath helper (import now targets currentFolder path directly)
  const onImportFolderSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      toast('No files detected in the selected folder');
      if (importFolderInputRef.current) importFolderInputRef.current.value='';
      return;
    }
    const rel = files[0].webkitRelativePath || files[0].name;
    const top = rel.split(/[\\/]/)[0] || 'Imported';
    const parentPath = currentFolder?.path || '';
    setPendingImport({ files, folderName: top, parentPath, includeSubfolders: true });
  };
  const confirmImportNow = async () => {
    if (!pendingImport) return;
    const { files, folderName, parentPath, includeSubfolders } = pendingImport;
    try {
      let baseDest = parentPath ? `${parentPath}/${folderName}` : folderName;
      baseDest = (baseDest || '').replace(/\\+/g, '/').replace(/^\//, '');

      // Build existing names under baseDest from current tree
      const existingByDir = new Map(); // relDir => Set(fileNames)
      const treeRootNode = tree && tree[0];
      const baseNode = treeRootNode ? findNodeByPath(treeRootNode, baseDest) : null;
      if (baseNode) {
        const stack = [{ node: baseNode, relDir: '' }];
        while (stack.length) {
          const { node, relDir } = stack.pop();
          if (!node) continue;
          if (Array.isArray(node.children)) {
            for (const ch of node.children) {
              if (ch.type === 'file') {
                const s = existingByDir.get(relDir) || new Set(); s.add(ch.name); existingByDir.set(relDir, s);
              } else if (ch.type === 'folder') {
                const nextRel = relDir ? `${relDir}/${ch.name}` : ch.name;
                stack.push({ node: ch, relDir: nextRel });
              }
            }
          }
        }
      }

      // Capacity pre-check (sum of all files to be imported; conservative)
      let delta = 0;
      let eligibleCount = 0;
      for (const f of files) {
        const rp = f.webkitRelativePath || f.name;
        const parts = rp.split(/[\\/]/);
        const inside = parts.slice(1).join('/');
        if (!includeSubfolders && inside.includes('/')) continue;
        eligibleCount += 1;
        delta += (f.size || 0);
      }
      if (eligibleCount === 0) {
        toast('No files to import from this folder selection. Try enabling "Include subfolders" or pick a folder with files.');
        return;
      }
      const capOk = ensureCapacityForDelta(delta);
      if (!capOk.ok) return;

      // Create container folder (ignore if exists)
      try { await storageApi.createFolder(user.username, safeBoxName, baseDest); } catch (e) {
        const status = e?.response?.status; const msg = (e?.response?.data || '').toString().toLowerCase();
        if (!(status === 409 || msg.includes('already exists'))) throw e;
      }

      let index = 0;
      const usedByDir = new Map(existingByDir);
      for (const f of files) {
        const rp = f.webkitRelativePath || f.name;
        const parts = rp.split(/[\\/]/);
        const inside = parts.slice(1).join('/');
        if (!includeSubfolders && inside.includes('/')) continue;
        const parentInside = inside.includes('/') ? inside.slice(0, inside.lastIndexOf('/')) : '';
        const fileName0 = inside ? inside.slice(inside.lastIndexOf('/') + 1) : f.name;
        let finalName = fileName0;
        const dirKey = parentInside;
        const set = usedByDir.get(dirKey) || new Set();

        if (set.has(finalName)) {
          // If user chose apply-all earlier, use it; otherwise prompt per-file
          let decision = (conflictDecisionRef.current.applyAll && conflictDecisionRef.current.action) ? conflictDecisionRef.current.action : null;
          if (!decision) {
            const relPathForPrompt = (dirKey ? `${dirKey}/` : '') + fileName0;
            // Await user choice via modal
            const choice = await new Promise((resolve) => {
              setSingleImportApplyAll(false);
              setSingleImportConflict({ path: relPathForPrompt });
              importConflictResolverRef.current = resolve;
            });
            if (choice === 'cancel') throw new Error('import-cancelled');
            decision = choice;
            if (singleImportApplyAll) {
              conflictDecisionRef.current = { action: decision, applyAll: true };
            }
          }
          if (decision === 'skip') { continue; }
          if (decision === 'keep-both') {
            const dot = finalName.lastIndexOf('.');
            const base = dot > 0 ? finalName.slice(0, dot) : finalName;
            const ext = dot > 0 ? finalName.slice(dot) : '';
            let i = 2; let candidate = `${base} (${i})${ext}`;
            while (set.has(candidate)) { i++; candidate = `${base} (${i})${ext}`; }
            finalName = candidate;
          }
        }

        set.add(finalName); usedByDir.set(dirKey, set);
        const relInside = parentInside ? `${parentInside}/${finalName}` : finalName;
        const relDest = `${baseDest}/${relInside}`;
        index++;
        setActivity({ active: true, label: `Importing ${f.name} (${index}/${files.length})`, percent: 0 });
        const controller = new AbortController(); activityAbortRef.current = controller;
  await storageApi.uploadFile(user.username, safeBoxName, relDest, f, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Importing ${f.name} (${index}/${files.length})`, percent: p }) });
      }

      toast.success('Folder imported');
      const root = await storageApi.getTree(user.username, safeBoxName);
  const newRootNode = { ...root, id: `${safeBoxName}-root`, name: safeBoxName };
  setTree([newRootNode]);
  setCurrentFolder(findNodeByPath(newRootNode, baseDest) || newRootNode);
    } catch (err) {
      if (err && err.message === 'import-cancelled') { toast('Import cancelled'); }
      else { toast.error(err?.response?.data || err?.message || 'Import failed'); }
    } finally {
      setActivity({ active: false, label: '', percent: null }); activityAbortRef.current = null;
      setPendingImport(null);
      importFolderInputRef.current && (importFolderInputRef.current.value = '');
      setImportConflictModal(null);
      conflictDecisionRef.current = { action: null, applyAll: false };
      // reset single-file modal state if any left hanging
  if (importConflictResolverRef.current) { try { importConflictResolverRef.current = null; } catch { /* ignore */ }
      }
      setSingleImportConflict(null);
      setSingleImportApplyAll(false);
    }
  };

  // Bulk update selected: open file picker and map by name (triggered via context menu)
  // Note: direct toolbar entry removed; keep only the input and modal flow

  const onBulkReplaceSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const selectedFiles = files.filter((f) => selected.has(f.id));
    const byName = new Map(selectedFiles.map(f => [f.name, f]));
    const matches = [];
    let ignored = 0;
    for (const file of picked) {
      const target = byName.get(file.name);
      if (target) matches.push({ picked: file, target }); else ignored++;
    }
    setPendingBulkReplace({ matches, ignored });
    if (bulkReplaceInputRef.current) bulkReplaceInputRef.current.value = '';
  };

  const confirmBulkReplaceNow = async () => {
    const bundle = pendingBulkReplace;
    if (!bundle || !bundle.matches || bundle.matches.length === 0) { setPendingBulkReplace(null); return; }
    try {
      // Capacity pre-check for bulk replace
      let delta = 0;
      for (const { picked, target } of bundle.matches) {
        const old = (target && typeof target.size === 'number') ? target.size : 0;
        const nv = picked?.size || 0;
        if (nv > old) delta += (nv - old);
      }
      const capOk = ensureCapacityForDelta(delta);
      if (!capOk.ok) return;
      let index = 0;
      for (const { picked, target } of bundle.matches) {
        index++;
        setActivity({ active: true, label: `Updating ${target.name} (${index}/${bundle.matches.length})`, percent: 0 });
        const rel = target.path || (currentFolder?.path ? `${currentFolder.path}/${target.name}` : target.name);
  const controller = new AbortController();
  activityAbortRef.current = controller;
  await storageApi.uploadFile(user.username, safeBoxName, rel, picked, { signal: controller.signal, onProgress: (p) => setActivity({ active: true, label: `Updating ${target.name} (${index}/${bundle.matches.length})`, percent: p }) });
  // removed mint highlight
      }
      toast.success(`Updated ${bundle.matches.length} file(s)`);
  // stats updated below
      const now3 = new Date().toISOString();
      setSessionLog(prev => [...prev, ...bundle.matches.map(({target}) => ({ ts: now3, action: 'UPDATE_FILE', path: target.path || (currentFolder?.path ? `${currentFolder.path}/${target.name}` : target.name) }))]);
      setFolderStats(prev => {
        const m = new Map(prev);
        const key = currentFolder.path || '';
        const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
        cur.updated += bundle.matches.length;
        m.set(key, cur);
        return m;
      });
      const root = await storageApi.getTree(user.username, safeBoxName);
      const rootNode = { ...root, id: `${safeBoxName}-root` };
      setTree([rootNode]);
      setCurrentFolder(findNodeByPath(rootNode, currentFolder?.path || '') || rootNode);
    } catch {
      toast.error(t('safeBoxDetail.toasts.bulkUpdateFailed'));
    } finally {
  setActivity({ active: false, label: '', percent: null });
  activityAbortRef.current = null;
      setPendingBulkReplace(null);
    }
  };

  // Create folder modal submit
  const submitCreateFolder = async (e) => {
    e.preventDefault();
    const name = newFolderName.trim().replaceAll('\\\\', '/');
    if (!name) return;
    const rel = currentFolder?.path ? `${currentFolder.path}/${name}` : name;
    try {
      await storageApi.createFolder(user.username, safeBoxName, rel);
  toast.success(t('safeBoxDetail.toasts.folderCreated'));
      const now4 = new Date().toISOString();
      setSessionLog(prev => [...prev, { ts: now4, action: 'CREATE_FOLDER', path: rel }]);
      setFolderStats(prev => {
        const m = new Map(prev);
        const key = currentFolder?.path || '';
        const cur = m.get(key) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
        cur.foldersCreated += 1;
        m.set(key, cur);
        return m;
      });
      const root = await storageApi.getTree(user.username, safeBoxName);
      const rootNode = { ...root, id: `${safeBoxName}-root` };
      setTree([rootNode]);
      setCurrentFolder(findNodeByPath(rootNode, rel) || rootNode);
      setShowFolderModal(false);
      setNewFolderName('');
    } catch (eCreate) {
  const msg = eCreate?.response?.data || eCreate.message || t('safeBoxDetail.toasts.folderCreateFailed');
  toast.error(msg);
    }
  };
  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); handleUploadClick(); }
  else if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setShowNewFolderConfirm(true); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); handleDownloadSelected(); }
      else if (e.key === 'Delete') { e.preventDefault(); confirmAndDelete(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDownloadSelected, confirmAndDelete]);

  // Format date helper
  const fmtDate = (iso) => {
    try {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      // Include date and time in local timezone
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch { return ''; }
  };

  const fmtBytes = (bytes) => {
    if (bytes == null || isNaN(bytes)) return '';
    if (bytes === 0) return '0 B';
    const thresh = 1024;
    if (bytes < thresh) return bytes + ' B';
    const units = ['KB','MB','GB','TB','PB'];
    let u = -1; let val = bytes;
    do { val /= thresh; ++u; } while (val >= thresh && u < units.length - 1);
    return (val < 10 ? val.toFixed(1) : Math.round(val)) + ' ' + units[u];
  };

  const handleDeleteSingle = (file) => {
    setSelected(new Set([file.id]));
    setConfirmDelete(true);
  };

  return (
  <div className="flex h-screen" onClick={closeContextMenu}>
      <SideMenu />
      <div className="flex-1 flex flex-col">
  <TopNav user={user} onLogout={logout} />
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Folder Tree with Action Buttons */
          }
          <aside className="w-64 min-w-[16rem] bg-white border-r border-gray-200 overflow-auto p-4" aria-label="Left panel">
            {/* Spacer to visually align the tree with the right panel's action buttons */}
            <div className="h-16 mb-2" aria-hidden="true" />
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-600">{t('safeBoxDetail.folders.title')}</div>
              <div className="flex items-center gap-1">
                <button title={t('safeBoxDetail.folders.newFolder')} aria-label={t('safeBoxDetail.folders.newFolder')} onClick={() => setShowNewFolderConfirm(true)} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                  <FolderPlus className="w-4 h-4" />
                </button>
                {/* Delete control removed from toolbar by request */}
                <button title={t('safeBoxDetail.folders.importFolder')} aria-label={t('safeBoxDetail.folders.importFolder')} onClick={handleImportFolderClick} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                  <Upload className="w-4 h-4" />
                </button>
                <button title={t('safeBoxDetail.folders.downloadZip')} aria-label={t('safeBoxDetail.folders.downloadZip')} onClick={() => downloadDirectory(currentFolder)} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <FileTree
              nodes={tree}
              // prefer path (unique) then id
              activeId={currentFolder?.path || currentFolder?.id}
              onSelectFolder={(node) => setCurrentFolder(node)}
              onContextMenuFolder={onContextMenuFolder}
              onRequestRenameFolder={requestRenameFolder}
              className="text-xs"
            />
          </aside>

          {/* Right: File List and Actions */}
          <main className="flex-1 p-6 overflow-auto" onDragOver={onDragOver} onDrop={onDrop}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-4">
                  <h1 className="text-3xl font-semibold text-blue-900">{currentFolder?.name || t('safeBoxDetail.header.root')}</h1>
                  {/* NEW: Safebox info to the right of the name */}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>
                      <span className="text-gray-500">{t('safeBoxDetail.header.created')}</span> {fmtDate(boxMeta.createdAt)}
                    </span>
                    <span>
                      <span className="text-gray-500">{t('safeBoxDetail.header.type')}</span> {boxMeta.boxType}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-gray-500">{t('safeBoxDetail.header.security')}</span>
                      {Array.from({ length: boxMeta.securityKeys }).map((_, i) => (
                        <KeySquare
                          key={i}
                          className="w-4 h-4 text-amber-500"
                          style={{ filter: 'drop-shadow(0 0 2px rgba(245,158,11,0.5))' }}
                          title={boxMeta.securityKeys === 1 ? t('safeBoxDetail.header.security.single') : t('safeBoxDetail.header.security.dual')}
                        />
                      ))}
                    </span>
                  </div>
                </div>
                <nav className="text-sm text-gray-500 mt-1">
                  {breadcrumbs.map((c, i) => (
                    <span key={c.path || 'root'}>
                      {i > 0 && ' / '}
                      <button
                        className={`hover:underline ${i === breadcrumbs.length - 1 ? 'text-gray-700 font-medium' : ''}`}
                        onClick={() => goToCrumb(c.path)}
                      >
                        {c.label}
                      </button>
                    </span>
                  ))}
                </nav>
              </div>
            </div>

            {/* Top action buttons */}
            <div className="flex items-center justify-between mb-4">
              {/* Left: primary actions */}
              <div className="flex space-x-2">
                <button
                  onClick={handleUploadClick}
                  className="flex items-center px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  title={t('safeBoxDetail.actions.upload.title')}
                >
                  <Upload className="w-3 h-3 mr-2" />
                  {t('safeBoxDetail.actions.upload')}
                </button>
                <button
                  onClick={handleDownloadSelected}
                  disabled={selected.size === 0}
                  className="flex items-center px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                  title={t('safeBoxDetail.actions.downloadSelected.title')}
                >
                  <Download className="w-3 h-3 mr-2" />
                  {t('safeBoxDetail.actions.download')}
                </button>
                <button
                  onClick={confirmAndDelete}
                  disabled={selected.size === 0}
                  className="flex items-center px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                  title={t('safeBoxDetail.actions.deleteSelected.title')}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  {t('safeBoxDetail.actions.deleteSelected')}
                </button>
              </div>

              {/* Right: utilities (progress and Cancel are shown only in the import/update popups) */}
              {/* utilities placeholder (print session log removed) */}

              {/* Hidden file inputs */}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesSelected} />
              {/* Import folder directory picker */}
              <input ref={importFolderInputRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={onImportFolderSelected} />
              <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceSelected} />
              <input ref={bulkReplaceInputRef} type="file" multiple className="hidden" onChange={onBulkReplaceSelected} />
            </div>

            {/* Loading state or Table of files */}
            {loading ? (
              <div className="text-gray-500">{t('safeBoxDetail.loading')}</div>
            ) : displayedFiles.length === 0 ? (
              <div className="p-12 text-center text-gray-500 border-2 border-dashed rounded">
                <p className="mb-2">{t('safeBoxDetail.empty.title')}</p>
                <p>{t('safeBoxDetail.empty.hint')}</p>
              </div>
            ) : (
              <div className="ve-card overflow-auto text-xs ve-filetable">
                <style>{`
                  @media (pointer: coarse) {
                    .ve-filetable table.ve-table th,
                    .ve-filetable table.ve-table td {
                      padding-top: 0.6rem !important;
                      padding-bottom: 0.6rem !important;
                    }
                  }
                `}</style>
                <table className="ve-table w-full table-fixed divide-y divide-gray-200">
                  <colgroup>
                    <col style={{width:'48px'}} />
                    <col />
                    <col style={{width:'90px'}} />
                    <col style={{width:'130px'}} />
                    <col style={{width:'130px'}} />
                    <col style={{width:'130px'}} />
                    <col style={{width:'120px'}} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="px-3 py-1.5 text-center">
                        <input
                          aria-label={t('safeBoxDetail.table.selectAll')}
                          type="checkbox"
                          checked={files.length > 0 && selected.size === files.length}
                          onChange={selectAll}
                        />
                      </th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.name')}</th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.size')}</th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.originalDate')}</th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.created')}</th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.updated')}</th>
                      <th className="px-3 py-1.5 text-left">{t('safeBoxDetail.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayedFiles.map((f, idx) => {
                      return (
                        <tr key={f.id} className={`hover:bg-sky-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-sky-50'}`}>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            aria-label={`Select ${f.name}`}
                            type="checkbox"
                            checked={selected.has(f.id)}
                            onChange={() => toggleSelect(f.id)}
                          />
                        </td>
                        <td className="px-3 py-1.5" onDoubleClick={()=> requestRenameFile(f)} title={t('safeBoxDetail.row.doubleClickRename')}>{f.name}</td>
                        <td className="px-3 py-1.5 text-[10px] whitespace-nowrap">{fmtBytes(f.size)}</td>
                        <td className="px-3 py-1.5 text-[10px] whitespace-nowrap">{fmtDate(f.originalDate)}</td>
                        <td className="px-3 py-1.5 text-[10px] whitespace-nowrap">{fmtDate(f.createdAt)}</td>
                        <td className="px-3 py-1.5 text-[10px] whitespace-nowrap">{fmtDate(f.modifiedAt) || f.uploadedAt}</td>
                        <td className="px-3 py-1.5 space-x-2">
                          <button onClick={(e) => { e.stopPropagation(); openDrawerFor(f); }} title={t('safeBoxDetail.row.preview')} aria-label={`${t('safeBoxDetail.row.preview')} ${f.name}`}>
                            {/* eye icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-700 hover:text-gray-900">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                          {user?.role === 'Owner' || user?.role === 'Client' ? (
                            <button onClick={(e) => { e.stopPropagation(); handleDownload(f); }} title={t('safeBoxDetail.row.download')} aria-label={`${t('safeBoxDetail.row.download')} ${f.name}`}>
                              <Download className="w-4 h-4 text-blue-600 hover:text-blue-800" />
                            </button>
                          ) : user?.role === 'Audit' ? (
                            <span title={t('safeBoxDetail.row.auditRole.cannotDownload')} className="inline-flex w-4 h-4 items-center justify-center text-gray-400 cursor-not-allowed">—</span>
                          ) : null}
                          <button onClick={(e) => { e.stopPropagation(); handleReplace(f); }} title={t('safeBoxDetail.row.replace')} aria-label={`${t('safeBoxDetail.row.replace')} ${f.name}`}>
                            <RefreshCcw className="w-4 h-4 text-yellow-600 hover:text-yellow-800" />
                          </button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteSingle(f); }} title={t('safeBoxDetail.row.delete')} aria-label={`${t('safeBoxDetail.row.delete')} ${f.name}`}>
                            <Trash2 className="w-4 h-4 text-red-600 hover:text-red-800" />
                          </button>
                        </td>
                      </tr>
                      );})}
                  </tbody>
                </table>
              </div>
            )}

            {showFolderModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-lg w-full max-w-sm p-4">
                  <h2 className="text-lg font-semibold mb-3">{t('safeBoxDetail.modal.createFolder.title')}</h2>
                  <form onSubmit={submitCreateFolder} className="space-y-3">
                    <input
                      autoFocus
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder={t('safeBoxDetail.modal.createFolder.placeholder')}
                      className="w-full border rounded p-2"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setShowFolderModal(false); setNewFolderName(''); }} className="px-2 py-0.5 text-xs rounded border">{t('safeBoxDetail.modal.createFolder.cancel')}</button>
                      <button type="submit" className="px-2 py-0.5 text-xs rounded bg-indigo-600 text-white">{t('safeBoxDetail.modal.createFolder.create')}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {showNewFolderConfirm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
                  <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.modal.confirmLocation.title')}</h2>
                  <p className="text-sm text-gray-600 mb-3">{t('safeBoxDetail.modal.confirmLocation.body')}</p>
                  <div className="font-mono text-xs bg-gray-50 border rounded p-2 mb-4">
                    {(() => {
                      const rel = currentFolder?.path ? currentFolder.path.replaceAll('/', '\\') : '';
                      return rel ? `${safeBoxName}\\${rel}` : `${safeBoxName}`;
                    })()}
                  </div>
                  <div className="flex justify-end gap-2 text-sm">
                    <button onClick={() => setShowNewFolderConfirm(false)} className="px-3 py-1 rounded border">{t('safeBoxDetail.modal.confirmLocation.cancel')}</button>
                    <button onClick={() => { setShowNewFolderConfirm(false); setShowFolderModal(true); }} className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">{t('safeBoxDetail.modal.confirmLocation.continue')}</button>
                  </div>
                </div>
              </div>
            )}

            {contextMenu && (
              <ul
                className="fixed z-50 bg-white border rounded shadow text-sm"
                style={{ top: contextMenu.y, left: contextMenu.x }}
              >
                <li>
                  <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left" onClick={() => { setShowNewFolderConfirm(true); closeContextMenu(); }}>
                    {t('safeBoxDetail.context.newFolder')}
                  </button>
                </li>
                <li>
                  <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left" onClick={() => { handleUploadClick(); closeContextMenu(); }}>
                    {t('safeBoxDetail.actions.upload')}
                  </button>
                </li>
                <li>
                  <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left" onClick={() => { handleImportFolderClick(); closeContextMenu(); }}>
                    {t('safeBoxDetail.folders.importFolder')}
                  </button>
                </li>
        {contextMenu?.folder?.path && (
                  <li>
          <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left text-red-600" onClick={() => { setDeleteFolderTarget({ name: contextMenu.folder.name, path: contextMenu.folder.path }); setShowDeleteFolderConfirm(true); closeContextMenu(); }}>
                      {t('safeBoxDetail.context.deleteFolder')}
                    </button>
                  </li>
                )}
                <li>
                  <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left" onClick={() => { if (contextMenu?.folder) requestRenameFolder(contextMenu.folder); closeContextMenu(); }}>
                    {t('safeBoxDetail.context.renameFolder')}
                  </button>
                </li>
                <li>
                  <button className="block px-4 py-2 hover:bg-gray-100 w-full text-left" onClick={() => { downloadDirectory(contextMenu.folder); closeContextMenu(); }}>
                    {t('safeBoxDetail.context.downloadZip')}
                  </button>
                </li>
              </ul>
            )}
          </main>
        </div>
      </div>
  {/* Box Settings Drawer */}
      {boxSettingsOpen && (
        <div className="fixed inset-y-0 left-0 w-full sm:w-[460px] bg-white border-r border-gray-200 shadow-xl z-40 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-gray-600" />
              <div className="text-base font-semibold">{t('safeBoxDetail.settings.drawerTitle')}</div>
            </div>
            <button className="text-gray-500 hover:text-gray-800" onClick={()=> setBoxSettingsOpen(false)} aria-label="Close settings">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Content */}
          <div className="p-4 space-y-4 text-sm overflow-auto">
            {/* Ownership Section */}
            <section className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-blue-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.ownerEmail')}</h3>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{t('safeBoxDetail.settings.ownerEmail.badge')}</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">{t('safeBoxDetail.settings.ownerEmail.help')}</p>
              <div className="flex items-center gap-2">
                <input value={ownerEmail} onChange={(e)=> setOwnerEmail(e.target.value)} className="flex-1 border rounded px-2 py-1" placeholder={t('safeBoxDetail.settings.ownerEmail.placeholder')} />
                <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded inline-flex items-center gap-1" onClick={()=>{
                  if (!user?.username || !safeBoxName) return;
                  localStorage.setItem(`safeboxOwnerEmail:${user.username}:${safeBoxName}`, ownerEmail.trim());
                  toast.success(t('safeBoxDetail.settings.ownerEmail.updated'));
                }}>
                  <SaveIcon className="w-3.5 h-3.5" /> {t('safeBoxDetail.settings.ownerEmail.save')}
                </button>
                <button className="px-2 py-1 text-xs border rounded" onClick={()=>{
                  if (!user?.username || !safeBoxName) return;
                  setOwnerEmail('');
                  localStorage.removeItem(`safeboxOwnerEmail:${user.username}:${safeBoxName}`);
                  toast(t('safeBoxDetail.settings.ownerEmail.cleared'));
                }}>{t('safeBoxDetail.settings.ownerEmail.clear')}</button>
              </div>
            </section>

            {/* Vault assignment (multivault) */}
            <section className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.vault')}</h3>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{t('safeBoxDetail.settings.vault.badge')}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{t('safeBoxDetail.settings.vault.help')}</p>
              <div>
                {(() => {
                  const username = user?.username;
                  if (!username) return <div className="text-xs text-gray-500">{t('safeBoxDetail.settings.vault.signInFirst')}</div>;
                  try {
                    const raw = localStorage.getItem(`vaultedge:vaults:${username}`) || '[]';
                    const list = JSON.parse(raw);
                    // resolve sbId for this safebox name (first occurrence)
                    const sbId = getIdForNameOccurrence(username, safeBoxName, 0) || safeBoxName;
                    const cur = localStorage.getItem(`safeboxVault:${username}:${sbId}`) || localStorage.getItem(`safeboxVault:${username}:${safeBoxName}`) || 'default';
                    const options = Array.isArray(list) ? list.map(c => ({ code: c.id, name: c.name, badge: c.badge })) : [];
                    return (
                      <CustomSelect
                        name="assignCompany"
                        value={cur}
                        onChange={(v) => {
                          try {
                            localStorage.setItem(`safeboxVault:${username}:${sbId}`, v);
                            // also keep legacy name-keyed assignment for backward compat
                            try { localStorage.setItem(`safeboxVault:${username}:${safeBoxName}`, v); } catch (ee) { console.warn('failed to write legacy safeboxVault', ee); }
                            toast.success(t('safeBoxDetail.settings.vault.saved'));
                            try { window.dispatchEvent(new CustomEvent('vaultedge:vaultsChanged')); } catch { /* ignore */ }
                          } catch (err) { console.warn('failed to save vault assignment', err); toast.error(t('safeBoxDetail.settings.vault.saveFailed')); }
                        }}
                        options={options}
                        addDefaultOption="Y"
                      />
                    );
                  } catch (err) {
                    console.warn('failed to load vaults', err);
                    return <div className="text-xs text-gray-500">{t('safeBoxDetail.settings.vault.loadFailed')}</div>;
                  }
                })()}
              </div>
            </section>

            {/* Email session summary preference */}
            <section className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-emerald-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.emailSummary')}</h3>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">{t('safeBoxDetail.settings.emailSummary.badge')}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{t('safeBoxDetail.settings.emailSummary.help')}</p>
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="emailSummaryPref" value="per-session" checked={emailSummaryPref === 'per-session'} onChange={(e)=>{
                    setEmailSummaryPref(e.target.value);
                    if (user?.username && safeBoxName) localStorage.setItem(`safeboxEmailSummaryPref:${user.username}:${safeBoxName}`, e.target.value);
                  }} />
                  <span>{t('safeBoxDetail.settings.emailSummary.perSession')}</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="emailSummaryPref" value="on-logout" checked={emailSummaryPref === 'on-logout'} onChange={(e)=>{
                    setEmailSummaryPref(e.target.value);
                    if (user?.username && safeBoxName) localStorage.setItem(`safeboxEmailSummaryPref:${user.username}:${safeBoxName}`, e.target.value);
                  }} />
                  <span>{t('safeBoxDetail.settings.emailSummary.onLogout')}</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="emailSummaryPref" value="never" checked={emailSummaryPref === 'never'} onChange={(e)=>{
                    setEmailSummaryPref(e.target.value);
                    if (user?.username && safeBoxName) localStorage.setItem(`safeboxEmailSummaryPref:${user.username}:${safeBoxName}`, e.target.value);
                  }} />
                  <span>{t('safeBoxDetail.settings.emailSummary.never')}</span>
                </label>
              </div>
            </section>

            {/* About Section */}
            <section className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.about')}</h3>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{t('safeBoxDetail.settings.about.badge')}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-gray-500">{t('safeBoxDetail.settings.meta.created')}</div>
                <div>{fmtDate(boxMeta.createdAt) || '—'}</div>
                <div className="text-gray-500">{t('safeBoxDetail.settings.meta.type')}</div>
                <div>{boxMeta.boxType}</div>
                <div className="text-gray-500 flex items-center gap-1">{t('safeBoxDetail.settings.meta.security')}</div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: boxMeta.securityKeys }).map((_, i) => (
                    <KeySquare key={i} className="w-4 h-4 text-amber-500" />
                  ))}
                  {boxMeta.securityKeys === 1 ? <span className="text-xs text-gray-600">{t('safeBoxDetail.settings.meta.singleKey')}</span> : <span className="text-xs text-gray-600">{t('safeBoxDetail.settings.meta.dualKey')}</span>}
                </div>
              </div>
            </section>

            {/* Audit retention Section */}
            <section className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.auditRetention')}</h3>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{t('safeBoxDetail.settings.auditRetention.badge')}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{t('safeBoxDetail.settings.auditRetention.help')}</p>
              <div className="flex items-center gap-2">
                <input type="number" min={7} className="w-24 border rounded px-2 py-1" value={(() => {
                  const k = `safeboxRetentionDays:${user?.username}:${safeBoxName}`;
                  const v = localStorage.getItem(k);
                  return v ? Number(v) : 30;
                })()}
                onChange={async (e)=>{
                  const days = Math.max(7, parseInt(e.target.value || '0',10));
                  localStorage.setItem(`safeboxRetentionDays:${user.username}:${safeBoxName}`, String(days));
                  try { await storageApi.setRetentionDays(user.username, safeBoxName, days); toast.success(t('safeBoxDetail.settings.auditRetention.updated')); } catch (e) { console.warn('Retention update failed', e); }
                  e.target.value = String(days);
                }} />
                <button className="px-2 py-1 text-xs border rounded" onClick={async ()=>{
                  try {
                    const days = await storageApi.getRetentionDays(user.username, safeBoxName);
                    localStorage.setItem(`safeboxRetentionDays:${user.username}:${safeBoxName}`, String(days));
                    toast(t('safeBoxDetail.settings.auditRetention.current', { days }));
                  } catch (e) { console.warn('Get retention failed', e); }
                }}>{t('safeBoxDetail.settings.auditRetention.sync')}</button>
              </div>
            </section>

            {/* Danger zone / utilities */}
            <section className="rounded-md border p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-red-600" />
                <h3 className="font-medium">{t('safeBoxDetail.settings.utilities')}</h3>
              </div>
              <p className="text-xs text-gray-600 mb-2">{t('safeBoxDetail.settings.utilities.help')}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <button className="px-2 py-1 rounded border" onClick={()=>{
                  if (!user?.username || !safeBoxName) return;
                  localStorage.removeItem(`safeboxOwnerEmail:${user.username}:${safeBoxName}`);
                  localStorage.removeItem(`safeboxEmailSummaryPref:${user.username}:${safeBoxName}`);
                  localStorage.removeItem(`pendingSummary:${user.username}:${safeBoxName}`);
                  localStorage.removeItem(`safeboxLastView:${user.username}:${safeBoxName}`);
                  localStorage.removeItem(`safeboxRememberLastView:${user.username}:${safeBoxName}`);
                  setOwnerEmail('');
                  setEmailSummaryPref('per-session');
                  setRememberLastView(true);
                  toast.success(t('safeBoxDetail.settings.utilities.resetPrefs.done'));
                }}>{t('safeBoxDetail.settings.utilities.resetPrefs')}</button>
              </div>
            </section>
          </div>
        </div>
      )}
  {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-3">{t('safeBoxDetail.rename.title', { type: renameTarget.type === 'folder' ? t('safeBoxDetail.context.newFolder') : t('safeBoxDetail.row.replace') })}</h2>
            <div className="mb-3 text-xs text-gray-600">
              <div className="font-mono bg-gray-50 border rounded p-2">
                {(renameTarget.parentPath ? renameTarget.parentPath + '/' : '') + renameTarget.currentName}
              </div>
            </div>
            <input autoFocus className="w-full border rounded p-2 mb-4" value={renameName} onChange={(e)=> setRenameName(e.target.value)} />
            <div className="flex justify-end gap-2 text-sm">
              <button className="px-3 py-1 rounded border" onClick={()=> setRenameTarget(null)}>{t('safeBoxDetail.rename.cancel')}</button>
              <button className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={confirmRename}>{t('safeBoxDetail.rename.confirm')}</button>
            </div>
          </div>
        </div>
      )}
  {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.delete.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('safeBoxDetail.delete.message', { count: selected.size })}</p>
                  {/* Removed last error banner */}
            <div className="flex justify-end gap-2 text-sm">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 rounded border">{t('safeBoxDetail.delete.cancel')}</button>
              <button onClick={() => { setConfirmDelete(false); handleDelete(); }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.delete.confirm')}</button>
            </div>
          </div>
        </div>
      )}
  {pendingUploads.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            {activity.active ? (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.upload.progress.title')}</h2>
                <div className="text-sm text-gray-700 mb-3">{activity.label}</div>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, activity.percent ?? 0))}%` }} />
                </div>
                <div className="flex justify-end gap-2 text-sm mt-4">
                  <button onClick={() => { try { activityAbortRef.current?.abort(); } catch { /* ignore */ } finally { setActivity({active:false,label:'',percent:null}); } }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.upload.progress.cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.upload.confirm.title')}</h2>
                <p className="text-sm text-gray-600 mb-3">{t('safeBoxDetail.upload.confirm.message', { count: pendingUploads.length, folder: currentFolder?.path || safeBoxName })}</p>
                <ul className="max-h-40 overflow-auto text-xs mb-4 list-disc pl-5 space-y-1">
                  {pendingUploads.slice(0,8).map(f => <li key={f.name}>{f.name} <span className="text-gray-500">({(f.size/1024/1024).toFixed(1)} MB)</span></li>)}
                  {pendingUploads.length > 8 && <li className="text-gray-500">{t('safeBoxDetail.upload.confirm.more', { count: pendingUploads.length - 8 })}</li>}
                </ul>
                <div className="flex justify-end gap-2 text-sm">
                  <button onClick={() => { setPendingUploads([]); if (fileInputRef.current) fileInputRef.current.value=''; }} className="px-3 py-1 rounded border">{t('safeBoxDetail.upload.confirm.cancel')}</button>
                  <button onClick={confirmUploadNow} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">{t('safeBoxDetail.upload.confirm.upload')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
  {conflictModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.conflict.title')}</h2>
            <p className="text-sm text-gray-600 mb-3">
              {t('safeBoxDetail.conflict.message', { count: conflictModal.names.length })}
            </p>
            <ul className="max-h-32 overflow-auto text-xs mb-4 list-disc pl-5 space-y-1">
              {conflictModal.names.slice(0,8).map(n => <li key={n}>{n}</li>)}
              {conflictModal.names.length > 8 && <li className="text-gray-500">{t('safeBoxDetail.upload.confirm.more', { count: conflictModal.names.length - 8 })}</li>}
            </ul>
            <label className="flex items-center gap-2 text-xs mb-3">
              <input type="checkbox" onChange={(e)=>{ conflictDecisionRef.current = { ...conflictDecisionRef.current, applyAll: e.target.checked }; }} />
              {t('safeBoxDetail.conflict.applyAll')}
            </label>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <button className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700" onClick={()=>{ conflictDecisionRef.current = { action: 'replace', applyAll: conflictDecisionRef.current.applyAll }; setConflictModal(null); confirmUploadNow(); }}>{t('safeBoxDetail.conflict.replace')}</button>
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>{ conflictDecisionRef.current = { action: 'keep-both', applyAll: conflictDecisionRef.current.applyAll }; setConflictModal(null); confirmUploadNow(); }}>{t('safeBoxDetail.conflict.keepBoth')}</button>
              <button className="px-2 py-1 rounded border" onClick={()=>{ conflictDecisionRef.current = { action: 'skip', applyAll: conflictDecisionRef.current.applyAll }; setConflictModal(null); confirmUploadNow(); }}>{t('safeBoxDetail.conflict.skip')}</button>
            </div>
          </div>
        </div>
      )}
  {importConflictModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.importConflict.title')}</h2>
            <p className="text-sm text-gray-600 mb-3">
              {t('safeBoxDetail.importConflict.message', { count: importConflictModal.names.length })}
            </p>
            <ul className="max-h-32 overflow-auto text-xs mb-4 list-disc pl-5 space-y-1">
              {importConflictModal.names.slice(0,8).map(n => <li key={n}>{n}</li>)}
              {importConflictModal.names.length > 8 && <li className="text-gray-500">{t('safeBoxDetail.upload.confirm.more', { count: importConflictModal.names.length - 8 })}</li>}
            </ul>
            <label className="flex items-center gap-2 text-xs mb-3">
              <input type="checkbox" onChange={(e)=>{ conflictDecisionRef.current = { ...conflictDecisionRef.current, applyAll: e.target.checked }; }} />
              {t('safeBoxDetail.importConflict.applyAll')}
            </label>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <button className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700" onClick={()=>{ conflictDecisionRef.current = { action: 'replace', applyAll: conflictDecisionRef.current.applyAll }; setImportConflictModal(null); confirmImportNow(); }}>{t('safeBoxDetail.conflict.replace')}</button>
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>{ conflictDecisionRef.current = { action: 'keep-both', applyAll: conflictDecisionRef.current.applyAll }; setImportConflictModal(null); confirmImportNow(); }}>{t('safeBoxDetail.conflict.keepBoth')}</button>
              <button className="px-2 py-1 rounded border" onClick={()=>{ conflictDecisionRef.current = { action: 'skip', applyAll: conflictDecisionRef.current.applyAll }; setImportConflictModal(null); confirmImportNow(); }}>{t('safeBoxDetail.conflict.skip')}</button>
            </div>
          </div>
        </div>
      )}
  {pendingReplace && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            {activity.active ? (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.replace.progress.title')}</h2>
                <div className="text-sm text-gray-700 mb-3">{activity.label}</div>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, activity.percent ?? 0))}%` }} />
                </div>
                <div className="flex justify-end gap-2 text-sm mt-4">
                  <button onClick={() => { try { activityAbortRef.current?.abort(); } catch { /* ignore */ } finally { setActivity({active:false,label:'',percent:null}); } }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.replace.progress.cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.replace.confirm.title')}</h2>
                <p className="text-sm text-gray-600 mb-4">{t('safeBoxDetail.replace.confirm.message', { old: pendingReplace.target.name, new: pendingReplace.file.name })}</p>
                <div className="flex justify-end gap-2 text-sm">
                  <button onClick={() => { setPendingReplace(null); if (replaceInputRef.current) replaceInputRef.current.value=''; }} className="px-3 py-1 rounded border">{t('safeBoxDetail.replace.confirm.cancel')}</button>
                  <button onClick={confirmReplaceNow} className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">{t('safeBoxDetail.replace.confirm.update')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
  {pendingBulkReplace && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            {activity.active ? (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.replace.progress.title')}</h2>
                <div className="text-sm text-gray-700 mb-3">{activity.label}</div>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, activity.percent ?? 0))}%` }} />
                </div>
                <div className="flex justify-end gap-2 text-sm mt-4">
                  <button onClick={() => { try { activityAbortRef.current?.abort(); } catch { /* ignore */ } finally { setActivity({active:false,label:'',percent:null}); } }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.bulkReplace.progress.cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.bulkReplace.confirm.title')}</h2>
                <p className="text-sm text-gray-600 mb-3">{t('safeBoxDetail.bulkReplace.confirm.message', { count: pendingBulkReplace.matches.length, ignored: pendingBulkReplace.ignored ? `; ${pendingBulkReplace.ignored}` : '' })}</p>
                <ul className="max-h-40 overflow-auto text-xs mb-4 list-disc pl-5 space-y-1">
                  {pendingBulkReplace.matches.slice(0,8).map(({target}) => <li key={target.id}>{target.name}</li>)}
                  {pendingBulkReplace.matches.length > 8 && <li className="text-gray-500">{t('safeBoxDetail.bulkReplace.confirm.more', { count: pendingBulkReplace.matches.length - 8 })}</li>}
                </ul>
                <div className="flex justify-end gap-2 text-sm">
                  <button onClick={() => setPendingBulkReplace(null)} className="px-3 py-1 rounded border">{t('safeBoxDetail.bulkReplace.confirm.cancel')}</button>
                  <button onClick={confirmBulkReplaceNow} className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">{t('safeBoxDetail.bulkReplace.confirm.update')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
  {showDeleteFolderConfirm && deleteFolderTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.deleteFolder.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('safeBoxDetail.deleteFolder.message', { name: deleteFolderTarget?.name })}</p>
            <div className="flex justify-end gap-2 text-sm">
              <button onClick={() => { setShowDeleteFolderConfirm(false); setDeleteFolderTarget(null); }} className="px-3 py-1 rounded border">{t('safeBoxDetail.deleteFolder.cancel')}</button>
              <button onClick={async ()=>{
                const target = deleteFolderTarget;
                setShowDeleteFolderConfirm(false);
                try {
                  if (!target?.path) return;
                  setActivity({ active: true, label: t('safeBoxDetail.deleteFolder.deleting', { name: target.name }), percent: 0 });
                  await storageApi.deleteFolder(user.username, safeBoxName, target.path);
                  // log + stats
                  const nowDel = new Date().toISOString();
                  setSessionLog(prev => [...prev, { ts: nowDel, action: 'DELETE_FOLDER', path: target.path }]);
                  setFolderStats(prev => {
                    const m = new Map(prev);
                    const parent = (target.path.lastIndexOf('/')>0) ? target.path.slice(0,target.path.lastIndexOf('/')) : '';
                    const cur = m.get(parent) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
                    cur.foldersDeleted += 1;
                    m.set(parent, cur);
                    return m;
                  });
                  const parentPath = (target.path.lastIndexOf('/')>0) ? target.path.slice(0,target.path.lastIndexOf('/')) : '';
                  const root = await storageApi.getTree(user.username, safeBoxName);
                  const rootNode = { ...root, id: `${safeBoxName}-root` };
                  setTree([rootNode]);
                  if (currentFolder?.path === target.path) {
                    setCurrentFolder(findNodeByPath(rootNode, parentPath) || rootNode);
                  }
                  toast.success(t('safeBoxDetail.toasts.folderDeleted'));
                } catch (eDel) {
                  toast.error(eDel?.response?.data || eDel?.message || t('safeBoxDetail.toasts.folderDeleteFailed'));
                } finally {
                  setActivity({ active: false, label: '', percent: null });
                  setDeleteFolderTarget(null);
                }
              }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.deleteFolder.confirm')}</button>
            </div>
          </div>
        </div>
      )}
  {pendingImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            {activity.active ? (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.import.progress.title')}</h2>
                <p className="text-sm text-gray-600 mb-2">{t('safeBoxDetail.import.progress.importing', { name: pendingImport.folderName })}</p>
                <p className="text-sm font-medium mb-2 truncate" title={activity.label}>{activity.label}</p>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, activity.percent ?? 0))}%` }} />
                </div>
                {activity.percent != null && <p className="text-right text-[10px] text-gray-500 mt-1">{activity.percent}%</p>}
                <div className="flex justify-end gap-2 text-sm mt-4">
                  <button onClick={() => { try { activityAbortRef.current?.abort(); } catch { /* ignore */ } finally { setActivity({ active:false, label:'', percent:null }); } }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">{t('safeBoxDetail.import.progress.cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.import.confirm.title')}</h2>
                <p className="text-sm text-gray-600 mb-2">{t('safeBoxDetail.import.confirm.message', { name: pendingImport.folderName })}</p>
                <p className="text-sm text-gray-600 mb-3">{t('safeBoxDetail.import.confirm.question')}</p>
                <div className="font-mono text-xs bg-gray-50 border rounded p-2 mb-3">
                  {(() => {
                    const rel = pendingImport.parentPath ? pendingImport.parentPath.replaceAll('/', '\\') : '';
                    return rel ? `${safeBoxName}\\${rel}` : `${safeBoxName}`;
                  })()}
                </div>
                <label className="flex items-center gap-2 text-xs mb-4">
                  <input type="checkbox" checked={pendingImport.includeSubfolders} onChange={(e)=> setPendingImport(prev => ({ ...prev, includeSubfolders: e.target.checked }))} />
                  {t('safeBoxDetail.import.confirm.includeSubfolders')}
                </label>
                <div className="flex justify-end gap-2 text-sm">
                  <button onClick={() => { setPendingImport(null); if (importFolderInputRef.current) importFolderInputRef.current.value = ''; }} className="px-3 py-1 rounded border">{t('safeBoxDetail.import.confirm.cancel')}</button>
                  <button onClick={confirmImportNow} className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">{t('safeBoxDetail.import.confirm.import')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
  {activity.active && !(pendingUploads.length > 0 || pendingReplace || pendingBulkReplace || pendingImport) && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg px-4 py-3 w-full max-w-sm mx-2 mb-4 sm:mb-0 animate-fade-in">
            <p className="text-sm font-medium mb-2 truncate" title={activity.label}>{activity.label}</p>
            <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${activity.percent ?? 0}%` }} />
            </div>
            {activity.percent != null && <p className="text-right text-[10px] text-gray-500 mt-1">{activity.percent}%</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { try { activityAbortRef.current?.abort(); } catch { /* ignore */ } finally { setActivity({ active:false, label:'', percent:null }); } }} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs">{t('safeBoxDetail.drawer.activity.cancel')}</button>
            </div>
          </div>
        </div>
      )}

  {/* Right-side drawer for Preview/Details */}
      {drawerOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="text-sm text-gray-500">{t('safeBoxDetail.drawer.details')}</div>
              <div className="text-base font-semibold truncate" title={previewFile?.name}>{previewFile?.name || '—'}</div>
            </div>
            <button className="text-gray-500 hover:text-gray-800" onClick={()=>{ setDrawerOpen(false); setPreviewFile(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null);} }}>{t('safeBoxDetail.drawer.close')}</button>
          </div>
          <div className="px-4 pt-3 border-b">
            <div className="flex gap-3 text-sm">
              {[
                { key:'Preview', label:t('safeBoxDetail.drawer.tabs.preview') },
                { key:'Metadata', label:t('safeBoxDetail.drawer.tabs.metadata') },
                { key:'Versions', label:t('safeBoxDetail.drawer.tabs.versions') },
                { key:'Audit', label:t('safeBoxDetail.drawer.tabs.audit') }
              ].map(tab => (
                <button key={tab.key} className={`px-2 py-1 rounded-t ${drawerTab===tab.key ? 'border-b-2 border-blue-600 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-800'}`} onClick={()=> setDrawerTab(tab.key)}>{tab.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 text-sm">
            {drawerTab === 'Preview' && (
              <div>
                {!previewFile ? (
                  <div className="text-gray-500">{t('safeBoxDetail.drawer.noFileSelected')}</div>
                ) : previewUrl ? (
                  (() => {
                    const name = (previewFile.name || '').toLowerCase();
                    if (name.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/)) {
                      return <img src={previewUrl} alt={previewFile.name} className="max-w-full h-auto" />;
                    }
                    if (name.match(/\.(pdf)$/)) {
                      return <iframe title="pdf" src={previewUrl} className="w-full h-[70vh] border" />;
                    }
                    if (name.match(/\.(txt|md|csv|json|log|xml|yaml|yml)$/)) {
                      return <iframe title="text" src={previewUrl} className="w-full h-[70vh] border bg-gray-50" />;
                    }
                    return <div className="text-gray-500">{t('safeBoxDetail.drawer.preview.notAvailableType')}</div>;
                  })()
                ) : (
                  <div className="text-gray-500">{t('safeBoxDetail.drawer.preview.notAvailable')}</div>
                )}
              </div>
            )}
            {drawerTab === 'Metadata' && previewFile && (
              <div className="space-y-2">
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.name')}</span> {previewFile.name}</div>
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.path')}</span> {previewFile.path || (currentFolder?.path ? `${currentFolder.path}/${previewFile.name}` : previewFile.name)}</div>
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.size')}</span> {fmtBytes(previewFile.size)}</div>
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.originalDate')}</span> {fmtDate(previewFile.originalDate)}</div>
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.created')}</span> {fmtDate(previewFile.createdAt)}</div>
                <div><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.updated')}</span> {fmtDate(previewFile.modifiedAt) || previewFile.uploadedAt}</div>
                <div className="flex items-center gap-1"><span className="text-gray-500">{t('safeBoxDetail.drawer.metadata.policy')}</span>
                  {previewFile.policyKeys === 1 ? (
                    <KeySquare className="w-4 h-4 text-amber-500" />
                  ) : (
                    <>
                      <KeySquare className="w-4 h-4 text-amber-500" />
                      <KeySquare className={`w-4 h-4 ${hasAuthorizedSecondary ? 'text-amber-500' : 'text-gray-300'}`} />
                    </>
                  )}
                </div>
              </div>
            )}
            {drawerTab === 'Versions' && (
              <div className="text-gray-500">{t('safeBoxDetail.drawer.versions.unavailable')}</div>
            )}
            {drawerTab === 'Audit' && (
              <div className="text-gray-500">{t('safeBoxDetail.drawer.audit.placeholder')}</div>
            )}
          </div>
        </div>
      )}
      {/* Per-file import conflict modal */}
      {singleImportConflict && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold mb-2">{t('safeBoxDetail.singleImportConflict.title')}</h2>
            <p className="text-sm text-gray-700 mb-2 break-words">{singleImportConflict.path}</p>
            <label className="flex items-center gap-2 text-xs mb-3">
              <input type="checkbox" checked={singleImportApplyAll} onChange={(e)=> setSingleImportApplyAll(e.target.checked)} />
              {t('safeBoxDetail.singleImportConflict.applyAll')}
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <button className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700" onClick={()=>{ if (singleImportApplyAll) conflictDecisionRef.current = { action: 'replace', applyAll: true }; importConflictResolverRef.current && importConflictResolverRef.current('replace'); setSingleImportConflict(null); }}>{t('safeBoxDetail.singleImportConflict.replace')}</button>
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>{ if (singleImportApplyAll) conflictDecisionRef.current = { action: 'keep-both', applyAll: true }; importConflictResolverRef.current && importConflictResolverRef.current('keep-both'); setSingleImportConflict(null); }}>{t('safeBoxDetail.singleImportConflict.keepBoth')}</button>
              <button className="px-2 py-1 rounded border col-span-2" onClick={()=>{ if (singleImportApplyAll) conflictDecisionRef.current = { action: 'skip', applyAll: true }; importConflictResolverRef.current && importConflictResolverRef.current('skip'); setSingleImportConflict(null); }}>{t('safeBoxDetail.singleImportConflict.skip')}</button>
            </div>
            <div className="flex justify-end text-sm">
              <button className="px-3 py-1 rounded border" onClick={()=>{ importConflictResolverRef.current && importConflictResolverRef.current('cancel'); setSingleImportConflict(null); }}>{t('safeBoxDetail.singleImportConflict.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
