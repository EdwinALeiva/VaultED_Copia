import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import { useAuth } from '../contexts/AuthContext';
import { storageApi } from '../services/storageApi';
import { useI18n } from '../contexts/I18nContext';
import { emailService } from '../services/emailService';
import { Filter } from 'lucide-react';

export default function AuditLog() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(200);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // Build human-readable summary of current filters for export metadata
  const buildFilterSummaryLines = () => {
    const lines = [];
    // Scope
    if (scopeSelections === null) lines.push('Scope: ALL');
    else if (scopeSelections.size === 0) lines.push('Scope: (none)');
    else lines.push('Scope: ' + Array.from(scopeSelections).sort().join(', '));
    // SafeBox
    if (selectedBoxes === null) lines.push('SafeBoxes: ALL');
    else if (selectedBoxes.size === 0) lines.push('SafeBoxes: (none)');
    else lines.push('SafeBoxes: ' + Array.from(selectedBoxes).sort().join(', '));
    // Timestamp
    if (tsFrom || tsTo) {
      lines.push(`Timestamp Range: ${tsFrom || '—'} to ${tsTo || '—'}`);
    } else {
      lines.push('Timestamp Range: ALL');
    }
    // Search
    if (search) lines.push('Search Contains: ' + search);
    return lines;
  };
  // Column filter UI state
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  // scopeSelections: null = ALL, Set([...]) = restricted selection, empty Set = none (show empty result)
  const [scopeSelections, setScopeSelections] = useState(null);
  const [safeBoxFilterOpen, setSafeBoxFilterOpen] = useState(false);
  // selectedBoxes: null = ALL, Set([...]) = restricted, empty Set = none
  const [selectedBoxes, setSelectedBoxes] = useState(null);
  const [tsFilterOpen, setTsFilterOpen] = useState(false);
  const [tsFrom, setTsFrom] = useState(''); // datetime-local string
  const [tsTo, setTsTo] = useState('');
  const [ownedBoxes, setOwnedBoxes] = useState([]); // for Owner role

  // Fuzzy matcher: tokens in query must appear in order; spaces can match underscores/hyphens/spaces in text
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fuzzyMessageMatch = (text, query) => {
    if (!query) return true;
    const t = (text || '').toLowerCase();
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean).map(escapeRegex);
    if (!tokens.length) return true;
  const pattern = tokens.join('[\\s_-]*');
    try {
      const re = new RegExp(pattern, 'i');
      return re.test(t);
    } catch {
      return t.includes(query.toLowerCase());
    }
  };

  // Precompute numeric inclusive bounds for timestamp filtering
  const { tsFromMs, tsToMs } = useMemo(() => {
    let fromMs = NaN, toMs = NaN;
    if (tsFrom) {
      const d = new Date(tsFrom);
      if (!isNaN(d.getTime())) fromMs = d.getTime();
    }
    if (tsTo) {
      const d2 = new Date(tsTo);
      if (!isNaN(d2.getTime())) {
        // Make the upper bound inclusive for the selected minute (if user didn't specify seconds)
        // Detect absence of seconds (pattern length 16: YYYY-MM-DDTHH:MM)
        if (tsTo.length === 16) {
          d2.setSeconds(59, 999);
        }
        toMs = d2.getTime();
      }
    }
    return { tsFromMs: fromMs, tsToMs: toMs };
  }, [tsFrom, tsTo]);

  const loadPage = React.useCallback(async (pg) => {
    if (!user?.username) return;
    try {
      setLoading(true);
      const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
      const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
  const res = await storageApi.fetchAuditSearch(user.username, {
        from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
        to: tsTo ? new Date(tsTo).toISOString() : undefined,
        scopes,
        safeboxes,
        page: pg,
        size
      });
      setEntries(Array.isArray(res.items) ? res.items : []);
      setTotal(typeof res.total === 'number' ? res.total : 0);
    } catch {
      setEntries([]); setTotal(0);
    } finally { setLoading(false); }
  }, [user?.username, scopeSelections, selectedBoxes, tsFrom, tsTo, size]);

  // Reset to page 0 when filters change, including message filter text
  useEffect(() => { setPage(0); }, [user?.username, scopeSelections, selectedBoxes, tsFrom, tsTo, search]);
  // Load whenever page or filters change
  useEffect(() => { loadPage(page); }, [loadPage, page]);

  // For Owners fetch their safebox list to know full set; for other roles read authorized list from localStorage.
  useEffect(() => {
    (async () => {
      if (!user?.username) return;
      if (user.role === 'Owner') {
        try {
          const boxes = await storageApi.listSafeBoxes(user.username);
          setOwnedBoxes(boxes);
        } catch { setOwnedBoxes([]); }
      }
    })();
  }, [user?.username, user?.role]);

  // Compute accessible safebox names based on role.
  const accessibleBoxes = useMemo(() => {
    if (!user?.username) return new Set();
    if (user.role === 'Owner') {
      return new Set(ownedBoxes);
    }
    // For non-owner roles, read authorized list from localStorage (demo simulation)
    try {
      const raw = localStorage.getItem(`authorizedSafeboxes:${user.username}`);
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    // Fallback: derive from entries safeBoxName field (only those explicitly present)
    const derived = entries.map(e => e.safeBoxName).filter(Boolean);
    return new Set(derived);
  }, [user?.username, user?.role, ownedBoxes, entries]);

  // Derive safebox from USER scope message prefix if missing
  const deriveBox = (e) => {
    if (e.safeBoxName) return e.safeBoxName;
    if (e.scope === 'USER' && e.message) {
      const idx = e.message.indexOf(':');
      if (idx > 0) return e.message.substring(0, idx).trim();
    }
    return null;
  };

  const fmtTs = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const filtered = entries.filter(e => {
    const boxName = deriveBox(e);
    // Enforce access: only include entries referencing accessible safebox OR user log lines referencing accessible box.
    if (boxName && accessibleBoxes.size && !accessibleBoxes.has(boxName)) return false;
    // SafeBox filter logic
    if (selectedBoxes !== null) {
      // selectedBoxes is a Set: empty => none, else must contain boxName
      if (selectedBoxes.size === 0) return false;
      if (!boxName || !selectedBoxes.has(boxName)) return false;
    }
    // Scope filter logic
    if (scopeSelections !== null) {
      if (scopeSelections.size === 0) return false; // none selected yields empty
      if (!scopeSelections.has(e.scope)) return false;
    }
    // Timestamp range (inclusive)
    if (!isNaN(tsFromMs) || !isNaN(tsToMs)) {
      const entryTime = Date.parse(e.timestamp);
      if (!isNaN(entryTime)) {
        if (!isNaN(tsFromMs) && entryTime < tsFromMs) return false;
        if (!isNaN(tsToMs) && entryTime > tsToMs) return false;
      }
    }
  if (search && !fuzzyMessageMatch(e.message, search)) return false;
    return true;
  });

  const toggleBoxSelection = (name) => {
    setSelectedBoxes(prev => {
      // If currently ALL (null), begin with full accessible set, then toggle off the clicked one.
      if (prev === null) {
        const all = new Set(accessibleBoxes);
        if (all.has(name)) all.delete(name); else all.add(name); // normally will delete
        return all;
      }
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const clearBoxSelection = () => setSelectedBoxes(new Set()); // empty => none
  const selectAllBoxes = () => setSelectedBoxes(null); // null => all
  const accessibleBoxList = useMemo(()=> Array.from(accessibleBoxes).sort(), [accessibleBoxes]);

  const exportPdf = async () => {
    // Fetch all filtered items by paging through server results
    const collectAll = async () => {
      const all = [];
      let pg = 0;
      while (true) {
        const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
        const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
  const res = await storageApi.fetchAuditSearch(user.username, {
          from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
          to: tsTo ? new Date(tsTo).toISOString() : undefined,
          scopes,
          safeboxes,
          page: pg,
          size: 500
        });
        const items = Array.isArray(res.items) ? res.items : [];
        all.push(...items);
        if (!res || !items.length || (pg + 1) * 500 >= (res.total || 0)) break;
        pg += 1;
      }
      return all;
    };
    const all = await collectAll();
    const filtered = all.filter(e => {
      // Reuse same filter logic: safebox/scope/timestamp already applied on server; apply message fuzzy only.
      return !search || fuzzyMessageMatch(e.message, search);
    });
  if (!filtered.length) { toast.error(t('auditLog.export.none')); return; }
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
      const marginX = 40;
      let y = 50;
      doc.setFont('helvetica','bold');
      doc.setFontSize(14);
      doc.text('Audit Log Export', marginX, y);
      y += 20;
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y); y += 12;
  doc.text(`User: ${user?.username || 'N/A'}`, marginX, y); y += 12;
  const filterLines = buildFilterSummaryLines();
  filterLines.forEach(fl => { doc.text(fl, marginX, y); y += 12; });
  y += 6; // small spacer before table
      const headers = ['Timestamp','Scope','SafeBox','Message'];
      const colWidths = [120,55,100,300];
      const lineHeight = 12;
      const pageHeight = doc.internal.pageSize.getHeight();
      // Header row
      doc.setFont('helvetica','bold');
      headers.forEach((h,i)=> doc.text(h, marginX + colWidths.slice(0,i).reduce((a,b)=>a+b,0), y));
      doc.setFont('helvetica','normal');
      y += lineHeight;
      const wrapText = (text, width) => doc.splitTextToSize(text, width - 4);
      filtered.forEach(entry => {
        const row = [fmtTs(entry.timestamp), entry.scope, entry.safeBoxName || '—', entry.message || ''];
        const wrappedCols = row.map((val,i)=> wrapText(String(val), colWidths[i]));
        const rowLines = Math.max(...wrappedCols.map(a=>a.length));
        // Page break check
        if (y + rowLines * lineHeight > pageHeight - 40) {
          doc.addPage();
          y = 50;
          doc.setFont('helvetica','bold');
          headers.forEach((h,i)=> doc.text(h, marginX + colWidths.slice(0,i).reduce((a,b)=>a+b,0), y));
          doc.setFont('helvetica','normal');
          y += lineHeight;
        }
        for (let lineIdx=0; lineIdx<rowLines; lineIdx++) {
          wrappedCols.forEach((colLines,i)=> {
            const text = colLines[lineIdx] || '';
            doc.text(text, marginX + colWidths.slice(0,i).reduce((a,b)=>a+b,0), y);
          });
          y += lineHeight;
        }
        y += 2; // small spacer
      });
      const filename = `audit-log-${Date.now()}.pdf`;
      doc.save(filename);
      toast.success(t('auditLog.export.pdf.success'));
    } catch (err) {
      console.error(err);
      toast.error(t('auditLog.export.pdf.error'));
    }
  };

  // Compute a summary from current filtered data and send via email
  const sendSummaryEmailFromFilters = async () => {
    try {
      // Collect all filtered entries across pages with the current filters
      const collectAll = async () => {
        const all = [];
        let pg = 0;
        while (true) {
          const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
          const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
          const res = await storageApi.fetchAuditSearch(user.username, {
            from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
            to: tsTo ? new Date(tsTo).toISOString() : undefined,
            scopes,
            safeboxes,
            q: search,
            page: pg,
            size: 500
          });
          const items = Array.isArray(res.items) ? res.items : [];
          all.push(...items);
          if (!res || !items.length || (pg + 1) * 500 >= (res.total || 0)) break;
          pg += 1;
        }
        return all;
      };

  const allItemsRaw = await collectAll();
  const allItems = allItemsRaw.filter(e => (!search || fuzzyMessageMatch(e.message, search)));
  if (!allItems.length) { toast.error(t('auditLog.export.none')); return; }

      // Derive safebox list and per-folder-ish summary from messages; we reuse the same summarization shape
      const ownerEmailFor = (box) => {
        try {
          if (!user?.username) return null;
          return localStorage.getItem(`safeboxOwnerEmail:${user.username}:${box}`);
        } catch { return null; }
      };

      // Group by safebox
      const byBox = new Map();
      for (const e of allItems) {
        const box = deriveBox(e) || 'Unknown';
        if (!byBox.has(box)) byBox.set(box, []);
        byBox.get(box).push(e);
      }

      // For each safebox with an owner email, build a perFolder summary and send one email
      for (const [box, items] of byBox.entries()) {
        const recipients = [];
        const owner = ownerEmailFor(box);
        if (owner && owner.includes('@')) recipients.push(owner);
        // include demo authorized if present
        if (localStorage.getItem(`safeboxSecondary:${user.username}:${box}`) === '1') {
          recipients.push(`${user.username}+authorized@example.com`);
        }
        if (!recipients.length) continue;

        // Summarize actions by folder key guessed from message (very simple heuristic: path after ':' or last slash groups)
        const folderAgg = new Map();
        const inc = (folder, field) => {
          const cur = folderAgg.get(folder) || { added:0, updated:0, deleted:0, foldersCreated:0, foldersDeleted:0 };
          cur[field] = (cur[field]||0) + 1;
          folderAgg.set(folder, cur);
        };
        for (const e of items) {
          const msg = e.message || '';
          // try to infer folder
          let folder = '/';
          const m1 = msg.match(/\bpath=([^\s]+)/i);
          if (m1 && m1[1]) {
            const p = m1[1].replace(/^\/+/, '');
            folder = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) || '/' : '/';
          }
          const text = msg.toLowerCase();
          if (text.includes('folders deleted') || text.includes('delete folder') || text.includes('removed folder')) inc(folder,'foldersDeleted');
          else if (text.includes('create folder') || text.includes('created folder') || text.includes('new folder')) inc(folder,'foldersCreated');
          else if (text.includes('rename')) inc(folder,'updated');
          else if (text.includes('delete') || text.includes('removed')) inc(folder,'deleted');
          else if (text.includes('upload') || text.includes('add ') || text.includes('added')) inc(folder,'added');
          else inc(folder,'updated');
        }
        const perFolder = Array.from(folderAgg.entries()).map(([folder, v]) => ({ folder, ...v }));
        const startedAt = tsFrom ? new Date(tsFrom).toISOString() : items[0]?.timestamp;
        const endedAt = tsTo ? new Date(tsTo).toISOString() : items[items.length-1]?.timestamp || new Date().toISOString();
        if (perFolder.length) {
          emailService.sendSessionSummary(user, box, recipients, { startedAt: startedAt || '', endedAt: endedAt || '', perFolder });
        }
      }
  toast.success(t('auditLog.summary.email.success'));
    } catch (e) {
      console.warn(e);
  toast.error(t('auditLog.summary.email.error'));
    }
  };

  const buildBaseFilename = (ext) => `audit-log-${Date.now()}.${ext}`;

  const exportCsv = async () => {
    const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
    const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
    let pg = 0; const acc = [];
    while (true) {
      const res = await storageApi.fetchAuditSearch(user.username, {
        from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
        to: tsTo ? new Date(tsTo).toISOString() : undefined,
        scopes, safeboxes, page: pg, size: 500
      });
      const items = Array.isArray(res.items) ? res.items : [];
      acc.push(...items);
      if (!items.length || (pg + 1) * 500 >= (res.total || 0)) break;
      pg += 1;
    }
  const filtered = acc.filter(e => (!search || fuzzyMessageMatch(e.message, search)));
  if (!filtered.length) { toast.error(t('auditLog.export.none')); return; }
    try {
      const header = ['timestamp','scope','safebox','message'];
      const meta = [
        '# Audit Log Export',
        `# Generated: ${new Date().toLocaleString()}`,
        `# User: ${user?.username || ''}`,
        ...buildFilterSummaryLines().map(l=>'# '+l),
        '#'
      ];
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g,'""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      const rows = filtered.map(e => header.map(h => {
        switch(h){
          case 'timestamp': return fmtTs(e.timestamp);
          case 'scope': return e.scope;
          case 'safebox': return e.safeBoxName || '';
          case 'message': return e.message || '';
          default: return '';
        }
      }).map(esc).join(','));
      const csv = [...meta, header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = buildBaseFilename('csv');
      a.click();
      toast.success(t('auditLog.export.csv.success'));
    } catch(err){ console.error(err); toast.error(t('auditLog.export.csv.error')); }
  };

  const exportXml = async () => {
    const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
    const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
    let pg = 0; const acc = [];
    while (true) {
      const res = await storageApi.fetchAuditSearch(user.username, {
        from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
        to: tsTo ? new Date(tsTo).toISOString() : undefined,
        scopes, safeboxes, page: pg, size: 500
      });
      const items = Array.isArray(res.items) ? res.items : [];
      acc.push(...items);
      if (!items.length || (pg + 1) * 500 >= (res.total || 0)) break;
      pg += 1;
    }
  const filtered = acc.filter(e => (!search || fuzzyMessageMatch(e.message, search)));
  if (!filtered.length) { toast.error(t('auditLog.export.none')); return; }
    try {
      const esc = (s='') => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const filtersXml = buildFilterSummaryLines().map(l=>`    <filter>${esc(l)}</filter>`).join('\n');
      const items = filtered.map(e => `  <entry timestamp="${esc(fmtTs(e.timestamp))}" scope="${esc(e.scope)}" safebox="${esc(e.safeBoxName||'')}">
    <message>${esc(e.message||'')}</message>
  </entry>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<auditLog generated="${esc(new Date().toISOString())}" user="${esc(user?.username||'')}">\n  <filters>\n${filtersXml}\n  </filters>\n${items}\n</auditLog>`;
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = buildBaseFilename('xml');
      a.click();
      toast.success(t('auditLog.export.xml.success'));
    } catch(err){ console.error(err); toast.error(t('auditLog.export.xml.error')); }
  };

  const exportMarkdown = async () => {
    const scopes = scopeSelections === null ? [] : Array.from(scopeSelections);
    const safeboxes = selectedBoxes === null ? [] : Array.from(selectedBoxes);
    let pg = 0; const acc = [];
    while (true) {
      const res = await storageApi.fetchAuditSearch(user.username, {
        from: tsFrom ? new Date(tsFrom).toISOString() : undefined,
        to: tsTo ? new Date(tsTo).toISOString() : undefined,
        scopes, safeboxes, page: pg, size: 500
      });
      const items = Array.isArray(res.items) ? res.items : [];
      acc.push(...items);
      if (!items.length || (pg + 1) * 500 >= (res.total || 0)) break;
      pg += 1;
    }
  const filtered = acc.filter(e => (!search || fuzzyMessageMatch(e.message, search)));
  if (!filtered.length) { toast.error(t('auditLog.export.none')); return; }
    try {
      const esc = (s='') => s.replace(/\|/g,'\\|');
      const header = '| Timestamp | Scope | SafeBox | Message |';
      const sep = '|-----------|-------|---------|---------|';
      const rows = filtered.map(e => `| ${esc(fmtTs(e.timestamp))} | ${esc(e.scope)} | ${esc(e.safeBoxName||'')} | ${esc((e.message||'').replace(/\n/g,' '))} |`);
      const md = [
        '# Audit Log Export',
        '',
        `Generated: ${new Date().toLocaleString()}`,
        `User: ${user?.username||''}`,
        ...buildFilterSummaryLines().map(l=>`- ${l}`),
        '',
        header,
        sep,
        ...rows
      ].join('\n');
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = buildBaseFilename('md');
      a.click();
      toast.success(t('auditLog.export.md.success'));
    } catch(err){ console.error(err); toast.error(t('auditLog.export.md.error')); }
  };

  // No per-row match navigation; search acts as a filter on Message only.

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav user={user} onLogout={logout} hideSearch={true} />
        <main className="p-6 overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h1 className="text-2xl font-semibold">{t('auditLog.title')}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1">
        <button onClick={sendSummaryEmailFromFilters} className="px-2 py-1 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50" disabled={loading || filtered.length===0} title={t('auditLog.actions.sendEmail')}>{t('auditLog.actions.sendEmail')}</button>
        <button onClick={exportPdf} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={loading || filtered.length===0} title={t('auditLog.actions.export.pdf')}>{t('auditLog.actions.export.pdf')}</button>
        <button onClick={exportCsv} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50" disabled={loading || filtered.length===0} title={t('auditLog.actions.export.csv')}>{t('auditLog.actions.export.csv')}</button>
        <button onClick={exportXml} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50" disabled={loading || filtered.length===0} title={t('auditLog.actions.export.xml')}>{t('auditLog.actions.export.xml')}</button>
        <button onClick={exportMarkdown} className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50" disabled={loading || filtered.length===0} title={t('auditLog.actions.export.md')}>{t('auditLog.actions.export.md')}</button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto ve-card text-sm relative min-h-[300px]">
      {loading && <div className="p-4 text-gray-500">{t('auditLog.loading')}</div>}
            <table className="ve-table w-full table-fixed divide-y divide-gray-200">
                <colgroup>
                  <col style={{width:'160px'}} />
                  <col style={{width:'70px'}} />
                  <col style={{width:'170px'}} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left relative">
                      <div className="flex items-center gap-1">
                        <span>{t('auditLog.filter.timestamp')}</span>
                        <button type="button" onClick={()=> setTsFilterOpen(o=> { const next = !o; if (next){ setScopeFilterOpen(false); setSafeBoxFilterOpen(false);} return next; })} className={`p-0.5 rounded hover:bg-gray-200 ${ (tsFrom||tsTo) ? 'text-blue-600' : 'text-gray-400'} `} title="Filter by timestamp">
                          <Filter size={14} />
                        </button>
                      </div>
                      {tsFilterOpen && (
                        <div className="absolute z-20 mt-1 left-0 bg-white border rounded shadow p-3 w-64 text-xs space-y-2">
                          <div className="font-semibold text-gray-700 tracking-wide text-[11px]">{t('auditLog.filter.timestampRange')}</div>
                          <label className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium tracking-wide text-gray-500">{t('auditLog.filter.from')}</span>
                            <input type="datetime-local" value={tsFrom} onChange={e=>setTsFrom(e.target.value)} className="border rounded px-1 py-0.5 focus:outline-none focus:ring focus:ring-blue-200" />
                          </label>
                          <label className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium tracking-wide text-gray-500">{t('auditLog.filter.to')}</span>
                            <input type="datetime-local" value={tsTo} onChange={e=>setTsTo(e.target.value)} className="border rounded px-1 py-0.5 focus:outline-none focus:ring focus:ring-blue-200" />
                          </label>
                          <div className="flex justify-between pt-1 border-t mt-1">
                            <button onClick={()=>{setTsFrom(''); setTsTo('');}} className="text-blue-600 hover:underline">{t('auditLog.filter.clear')}</button>
                            <div className="flex gap-3">
                              <button onClick={()=> setTsFilterOpen(false)} className="text-gray-600 hover:underline">{t('auditLog.filter.close')}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="px-3 py-2 text-left relative">
                      <div className="flex items-center gap-1">
                        <span>{t('auditLog.filter.scope')}</span>
                        <button
                          type="button"
                          onClick={()=> setScopeFilterOpen(o=> { const next = !o; if (next){ setTsFilterOpen(false); setSafeBoxFilterOpen(false);} return next; })}
                          className={`p-0.5 rounded hover:bg-gray-200 ${ (()=>{ const total=2; if (scopeSelections===null) return 'text-gray-400'; if (scopeSelections.size===total) return 'text-gray-400'; return 'text-blue-600'; })() }`}
                          title="Filter by scope"
                        >
                          <Filter size={14} />
                        </button>
                      </div>
                      {scopeFilterOpen && (
                        <div className="absolute z-20 mt-1 left-0 bg-white border rounded shadow p-3 w-48 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold tracking-wide text-[11px] text-gray-700">{t('auditLog.filter.scope.title')}</span>
                            {scopeSelections !== null && <button onClick={()=> setScopeSelections(null)} className="text-blue-600 hover:underline">{t('auditLog.filter.scope.all')}</button>}
                          </div>
                          <div className="space-y-1 mb-2">
                            {['USER','SAFEBOX'].map(sc => (
                              <label key={sc} className="flex items-center gap-2 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={scopeSelections ? scopeSelections.has(sc) : true} onChange={()=> setScopeSelections(prev=> {
                                  if (prev === null) prev = new Set(['USER','SAFEBOX']);
                                  const n=new Set(prev);
                                  if (n.has(sc)) n.delete(sc); else n.add(sc);
                                  return n;
                                })} />
                                <span className="text-[11px] font-medium">{sc}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <button onClick={()=> setScopeSelections(new Set())} className="text-blue-600 hover:underline">{t('auditLog.filter.clear')}</button>
                            <button onClick={()=> setScopeFilterOpen(false)} className="text-gray-600 hover:underline">{t('auditLog.filter.close')}</button>
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="px-3 py-2 text-left relative">
                      <div className="flex items-center gap-1">
                        <span>{t('auditLog.filter.safebox')}</span>
                        <button
                          type="button"
                          onClick={()=> setSafeBoxFilterOpen(o=> { const next = !o; if (next){ setTsFilterOpen(false); setScopeFilterOpen(false);} return next; })}
                          className={`p-0.5 rounded hover:bg-gray-200 ${ (()=>{ if (selectedBoxes===null) return 'text-gray-400'; const total = accessibleBoxList.length; if (total>0 && selectedBoxes.size===total) return 'text-gray-400'; return 'text-blue-600'; })() }`}
                          title="Filter by safebox"
                        >
                          <Filter size={14} />
                        </button>
                      </div>
                      {safeBoxFilterOpen && (
                        <div className="absolute z-20 mt-1 left-0 bg-white border rounded shadow p-3 w-60 max-h-64 overflow-auto text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold tracking-wide text-[11px] text-gray-700">{t('auditLog.filter.safebox.title')}</span>
                            {selectedBoxes !== null && <button onClick={selectAllBoxes} className="text-blue-600 hover:underline">{t('auditLog.filter.safebox.all')}</button>}
                          </div>
                          <div className="space-y-1 mb-2">
                            {accessibleBoxList.length === 0 ? <div className="text-gray-500">{t('auditLog.filter.safebox.none')}</div> : accessibleBoxList.map(name => (
                              <label key={name} className="flex items-center gap-2 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={selectedBoxes ? selectedBoxes.has(name) : true} onChange={()=> toggleBoxSelection(name)} />
                                <span className="truncate text-[11px] font-medium" title={name}>{name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <button onClick={clearBoxSelection} className="text-blue-600 hover:underline">{t('auditLog.filter.clear')}</button>
                            <button onClick={()=> setSafeBoxFilterOpen(false)} className="text-gray-600 hover:underline">{t('auditLog.filter.close')}</button>
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="px-3 py-2 text-left">
                      <div className="flex items-center gap-2">
                        <span>{t('auditLog.filter.message')}</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
                            <Filter size={14} />
                          </span>
                          <input
                            value={search}
                            onChange={(e)=> setSearch(e.target.value)}
                            placeholder={t('auditLog.filter.message.placeholder')}
                            className="border rounded pl-7 pr-2 py-1 text-xs w-48 md:w-64"
                          />
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
          {(!loading && filtered.length === 0) && (
                    <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-gray-400 text-xs">{t('auditLog.empty')}</td>
                    </tr>
                  )}
          {filtered.map((e,i)=>{
                    let derivedBox = deriveBox(e);
                    return (
            <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] font-normal">{fmtTs(e.timestamp)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-normal tracking-wide ${e.scope === 'USER' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{e.scope}</span>
                        </td>
                        <td className="px-3 py-2">
                          {derivedBox ? (
                            <button className="text-blue-600 hover:underline text-[10px] font-normal" onClick={()=>navigate(`/safebox/${encodeURIComponent(derivedBox)}`)}>{derivedBox}</button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 break-all text-[11px] leading-snug">{e.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Pager */}
              <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600">
                <div>
                  {total > 0 ? (
                    t('auditLog.pager.showing',{from: filtered.length ? page * size + 1 : 0, to: page * size + filtered.length, total})
                  ) : t('auditLog.pager.noResults')}
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-0.5 border rounded disabled:opacity-50" disabled={page<=0 || loading} onClick={()=> setPage(p=> Math.max(0, p-1))}>{t('auditLog.pager.prev')}</button>
                  <button className="px-2 py-0.5 border rounded disabled:opacity-50" disabled={(page+1)*size >= total || loading} onClick={()=> setPage(p=> p+1)}>{t('auditLog.pager.next')}</button>
                </div>
              </div>
          </div>
        </main>
      </div>
    </div>
  );
}