// src/components/Dashboard.jsx (refactored after PRP integration)
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';
import SideMenu from './SideMenu';
import { useAuth } from '../contexts/AuthContext';
import { storageApi } from '../services/storageApi';
import { toast } from 'react-hot-toast';
import { KeySquare, AlertTriangle, Search, ArrowDownUp, SortAsc, SortDesc } from 'lucide-react';
import VaultsPanel from './VaultsPanel';
import SafeBoxIcon from './SafeBoxIcon';
import { ensureRegistryForNames } from '../services/safeboxRegistry';
import CustomSelect from './CustomSelect';
import RightPanel from './RightPanel';
import { useI18n } from '../contexts/I18nContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  // Core state
  const [search, setSearch] = useState(''); // applied value
  const [searchDraft, setSearchDraft] = useState(''); // controlled input in top bar
  const [boxes, setBoxes] = useState([]); // raw list
  const [usage, setUsage] = useState([]); // enriched list
  const [selectedBoxes, setSelectedBoxes] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [sortKey, setSortKey] = useState('name_asc');
  const [selectedCompany, setSelectedCompany] = useState(null); // vault selection id
  const [sizeRangeFilter, setSizeRangeFilter] = useState(null); // { rangeKey, boxes:Set }

  const handleSizeRangeFilter = (rangeKey, boxesSet) => {
    if (!rangeKey || !boxesSet) { setSizeRangeFilter(null); return; }
    setSizeRangeFilter({ rangeKey, boxes: boxesSet });
  };

  // Synthetic metadata (until backend exposes more fields)
  const hashString = (s='') => { let h=0; for (let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0;} return Math.abs(h); };
  const metaFor = useCallback((boxName) => {
  if (!user?.username) return { createdAt:'', boxType:t('safebox.type.personal','') || 'Personal', securityKeys:1 };
    const k = `safeboxMeta:${user.username}:${boxName}`;
    const existing = localStorage.getItem(k);
    if (existing) { try { return JSON.parse(existing); } catch {/* ignore */} }
    const now = Date.now();
    const daysBack = (hashString(boxName) % 365) + 1;
    const createdAt = new Date(now - daysBack*86400000).toISOString();
  const boxType = hashString(boxName+'type') % 2 === 0 ? (t('safebox.type.personal')||'Personal') : (t('safebox.type.business')||'Business');
    const securityKeys = hashString(boxName+'sec') % 2 === 0 ? 1:2;
    const meta = { createdAt, boxType, securityKeys };
    localStorage.setItem(k, JSON.stringify(meta));
    return meta;
  }, [user?.username, t]);

  const fmtDate = (iso) => { try { if (!iso) return ''; const d=new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`; } catch { return ''; } };
  const fmtBytes = (bytes) => { if (bytes == null) return '0 B'; const u=['B','KB','MB','GB','TB']; let v=bytes,i=0; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v>=10||i===0?0:1)} ${u[i]}`; };
  const buildGradient = (p) => { let from='#16a34a', to='#4ade80'; if (p>50 && p<=80){ from='#fbbf24'; to='#f97316'; } else if (p>80){ from='#f97316'; to='#dc2626'; } return `linear-gradient(to right, ${from}, ${to})`; };

  // Load boxes
  const fetchBoxes = useCallback(async () => {
    if (!user?.username) return;
    try {
      setLoading(true);
      await storageApi.ensureUser(user.username);
      const names = await storageApi.listSafeBoxes(user.username);
      const ids = ensureRegistryForNames(user.username, names);
      const mapped = names.map((name, idx) => ({ id: ids[idx], name, meta: metaFor(name) }));
      // Assign vault if missing
      try {
        const rootKey = `vaultedge:rootVault:${user.username}`;
        const rootId = localStorage.getItem(rootKey);
        for (const b of mapped) {
          const idKey = `safeboxVault:${user.username}:${b.id}`;
          if (!localStorage.getItem(idKey) || localStorage.getItem(idKey) === 'default') {
            const legacy = localStorage.getItem(`safeboxVault:${user.username}:${b.name}`);
            if (legacy) localStorage.setItem(idKey, legacy); else if (rootId) localStorage.setItem(idKey, rootId);
          }
        }
      } catch {/* ignore */}
      setBoxes(mapped);
    } catch (e) {
      setBoxes([]);
  toast.error(e?.response?.data || t('dashboard.error.loadBoxes'));
    } finally { setLoading(false); }
  }, [user?.username, metaFor, t]);

  // Load usage
  const loadUsage = useCallback(async () => {
    if (!user?.username) return;
    try {
      setLoadingUsage(true);
      const backendUsage = await storageApi.listSafeBoxesUsage(user.username);
      const usageByName = Object.fromEntries(backendUsage.map(u => [u.safeBoxName, u]));
      const DEFAULT_CAPACITY = 10 * 1024 * 1024 * 1024;
      const enriched = boxes.map(b => {
        const u = usageByName[b.name] || { usedBytes: 0, capacityBytes: 0, fileCount: 0 };
        const metaCap = b.meta?.capacityBytes && b.meta.capacityBytes > 0 ? b.meta.capacityBytes : 0;
        const reportedCap = u.capacityBytes || 0;
        const chosenCapacity = metaCap > 0 ? metaCap : reportedCap;
        const capacityKnown = chosenCapacity > 0;
        const effectiveCapacity = capacityKnown ? chosenCapacity : DEFAULT_CAPACITY;
        const percent = effectiveCapacity > 0 ? (u.usedBytes / effectiveCapacity) * 100 : 0;
  // Renewal lifecycle (synthetic example): yearly renewal + 15d grace window
  const createdAtMs = b.meta?.createdAt ? new Date(b.meta.createdAt).getTime() : Date.now();
  const YEAR_MS = 365 * 86400000;
  const GRACE_MS = 15 * 86400000;
  const RENEW_SOON_MS = 14 * 86400000; // show approaching within 14 days before due
  const dueAt = createdAtMs + YEAR_MS;
  const graceEndAt = dueAt + GRACE_MS;
  const now = Date.now();
  let lifecycleStatus = null; // RENEWAL_SOON | GRACE | BLOCKED
  if (now > graceEndAt) lifecycleStatus = 'BLOCKED';
  else if (now >= dueAt) lifecycleStatus = 'GRACE';
  else if (dueAt - now <= RENEW_SOON_MS) lifecycleStatus = 'RENEWAL_SOON';
  return { ...b, bytes: u.usedBytes, files: u.fileCount, capacity: effectiveCapacity, capacityKnown, percent, notice: percent>=25 && percent<80, approaching: percent>=80 && percent<95, critical: percent>=95, renewalDueAt: dueAt, renewalGraceEndAt: graceEndAt, lifecycleStatus };
      });

      // Inject demo lifecycle statuses (only for visual demonstration)
      try {
        const now = Date.now();
        const DAY = 86400000;
        const demoRenew = enriched.find(b => b.name === 'Codigo fuente proveedor 1');
        if (demoRenew) {
          demoRenew.lifecycleStatus = 'RENEWAL_SOON';
          demoRenew.renewalDueAt = now + 5*DAY; // due in 5 days
        }
        const demoGrace = enriched.find(b => b.name === 'my fistTest');
        if (demoGrace) {
          demoGrace.lifecycleStatus = 'GRACE';
          demoGrace.renewalDueAt = now - 2*DAY; // already due 2 days ago
          demoGrace.renewalGraceEndAt = now + 7*DAY; // 7 days left in grace
        }
        // Pick another box (first different) to display BLOCKED watermark demo if none already blocked
        const anyBlocked = enriched.some(b => b.lifecycleStatus === 'BLOCKED');
        if (!anyBlocked) {
          const blockedCandidate = enriched.find(b => b.name !== 'Codigo fuente proveedor 1' && b.name !== 'my fistTest');
          if (blockedCandidate) {
            blockedCandidate.lifecycleStatus = 'BLOCKED';
            blockedCandidate.renewalDueAt = now - 20*DAY;
            blockedCandidate.renewalGraceEndAt = now - 5*DAY;
          }
        }
      } catch { /* ignore demo injection errors */ }
      setUsage(enriched);
      // Seed demo approval if none exists for visual testing
      try {
        if (user?.username) {
          const key = `vaultedge:approvals:${user.username}`;
            const raw = localStorage.getItem(key);
            let arr = [];
            if (raw) { try { arr = JSON.parse(raw); if(!Array.isArray(arr)) arr=[]; } catch { arr=[]; } }
            if (!arr.length) {
              const target = enriched.find(b => (b.meta?.securityKeys||1)===2) || enriched[0];
              if (target) {
                arr.push({ id: 'demo-approval-1', boxName: target.name, type: 'Download', createdAt: Date.now() });
                localStorage.setItem(key, JSON.stringify(arr));
              }
            }
        }
      } catch { /* ignore demo approval seed */ }
    } catch (e) {
  toast.error(e?.response?.data || t('dashboard.error.loadUsage'));
      setUsage([]);
    } finally { setLoadingUsage(false); }
  }, [user?.username, boxes, t]);

  // Effects
  useEffect(() => { fetchBoxes(); const h=()=>fetchBoxes(); window.addEventListener('vaultedge:refreshDashboard', h); return ()=> window.removeEventListener('vaultedge:refreshDashboard', h); }, [fetchBoxes]);
  useEffect(() => { if (boxes.length) loadUsage(); else setUsage([]); }, [boxes, loadUsage]);
  useEffect(() => { if (!user?.username) return; const pref = localStorage.getItem(`vaultedge:selectedVault:${user.username}`) || null; setSelectedCompany(pref); }, [user?.username]);
  useEffect(() => { const h = (ev) => { try { const id = ev?.detail?.id; if (id) setSelectedCompany(id); } catch {/*ignore*/} }; window.addEventListener('vaultedge:selectedVaultChanged', h); return ()=> window.removeEventListener('vaultedge:selectedVaultChanged', h); }, []);
  useEffect(() => { if (!user?.username) return; if (!selectedCompany || selectedCompany === 'default') return; const any = boxes.some(b => (localStorage.getItem(`safeboxVault:${user.username}:${b.id}`)||'default') === selectedCompany); if (!any) { setSelectedCompany(null); try { localStorage.removeItem(`vaultedge:selectedVault:${user.username}`);} catch {/*ignore*/} } }, [boxes, selectedCompany, user?.username]);
  useEffect(() => { if (boxes.length === 1 && selectedBoxes.size) setSelectedBoxes(new Set()); }, [boxes.length, selectedBoxes.size]);

  // Filtering & sorting
  const showControls = boxes.length > 1;
  const filtered = usage.filter(b => {
    if (selectedCompany && selectedCompany !== 'default') {
      const assigned = localStorage.getItem(`safeboxVault:${user?.username}:${b.id}`) || 'default';
      if (assigned !== selectedCompany) return false;
    }
    if (sizeRangeFilter && !sizeRangeFilter.boxes.has(b.name)) return false;
    return !showControls || b.name.toLowerCase().includes(search.toLowerCase());
  });
  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const parseSort = (key) => { const i = key.lastIndexOf('_'); return i>0 ? [key.slice(0,i), key.slice(i+1)] : [key,'desc']; };
  const [field, dir] = parseSort(sortKey || 'name_asc');
    const mul = dir === 'desc' ? -1 : 1; // we invert comparator result when desc
    const cmp = (a,b,valA,valB) => {
      if (valA < valB) return -1 * mul; if (valA > valB) return 1 * mul; return 0;
    };
    arr.sort((a,b) => {
      switch (field) {
        case 'createdAt': return cmp(a,b,new Date(a.meta?.createdAt||0).getTime(), new Date(b.meta?.createdAt||0).getTime());
        case 'capacity': return cmp(a,b,a.capacity,b.capacity);
        case 'used': return cmp(a,b,a.bytes,b.bytes);
        case 'available': return cmp(a,b,a.capacity-a.bytes, b.capacity-b.bytes);
        case 'security': return cmp(a,b,a.meta?.securityKeys||0, b.meta?.securityKeys||0);
        case 'type': return cmp(a,b,(a.meta?.boxType||'').localeCompare(b.meta?.boxType||''),0); // localeCompare already gives -1/0/1
        case 'name': return cmp(a,b,a.name.localeCompare(b.name),0);
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortKey]);

  // Selection helpers
  const toggleSelect = (boxId) => setSelectedBoxes(prev => { const next = new Set(prev); next.has(boxId)? next.delete(boxId): next.add(boxId); return next; });

  // Dynamic search: debounce input, apply when >=2 chars; otherwise reset filter
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft.trim().length >= 2) {
        setSearch(searchDraft.trim());
      } else if (searchDraft.trim().length === 0) {
        setSearch('');
      }
      // if 1 char do nothing (wait for second)
    }, 220); // light debounce
    return () => clearTimeout(handle);
  }, [searchDraft]);

  return (
    <div className="flex h-screen">
      <SideMenu />
      <div className="flex-1 flex flex-col">
        <TopNav
          user={user}
          onLogout={logout}
          hideSearch={false}
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          onSearchSubmit={(v)=> setSearch(v.trim())}
          searchPlaceholder={t('dashboard.search.placeholder')}
        />
        <main className="p-6 overflow-auto">
          <div className="flex items-center mb-4"><h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1></div>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-6">
              <VaultsPanel />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col 2xl:flex-row gap-6">
                  {/* SafeBoxes list */}
                  <div className="w-full 2xl:w-1/2 flex flex-col">
                    <div className="bg-white border rounded p-4 flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <SafeBoxIcon size={20} className="text-gray-700" />
                        <h2 className="text-sm font-semibold">{t('dashboard.boxes.title')}</h2>
                        <div className="ml-auto flex items-center gap-2">
                          {sizeRangeFilter && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1" title={t('dashboard.filter.sizeRange.title')}>
                              <span>{sizeRangeFilter.rangeKey}</span>
                              <button onClick={()=> setSizeRangeFilter(null)} className="text-blue-600 hover:text-blue-800" aria-label={t('dashboard.filter.sizeRange.clear')}>×</button>
                            </span>
                          )}
                          {showControls && <SortCompact sortKey={sortKey} onChange={setSortKey} />}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 flex-1 overflow-auto pr-1">
                        {loading ? (<p className="text-gray-500">{t('dashboard.loading.list')}</p>) : (loadingUsage && !usage.length) ? (<p className="text-gray-500">{t('dashboard.loading.usage')}</p>) : sorted.length > 0 ? (
                          sorted.map(box => {
                            const isBlocked = box.lifecycleStatus === 'BLOCKED';
                            return (
                            <div
                              key={box.id}
                              onClick={(e)=> {
                                if (isBlocked) { e.preventDefault(); e.stopPropagation(); return; }
                                if (!(e.target.closest('input[type="checkbox"]'))) navigate(`/safebox/${encodeURIComponent(box.name)}`);
                              }}
                              className={`ve-card p-3 hover:shadow-md relative w-full ${isBlocked? 'cursor-not-allowed': 'cursor-pointer'} border ${isBlocked ? 'border-red-300' : box.critical ? 'border-red-500' : box.approaching ? 'border-amber-400' : 'border-gray-200'} ${selectedBoxes.has(box.id)?'ring-2 ring-blue-500 ring-offset-1':''}`}
                              style={isBlocked ? { borderColor: '#fca5a5' } : undefined}
                              aria-disabled={isBlocked || undefined}
                            >
                              {isBlocked && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="text-4xl font-black tracking-widest text-red-500/15 select-none rotate-[-18deg] drop-shadow-sm">{t('dashboard.box.blockedWatermark')}</span>
                                </div>
                              )}
                              {showControls && (
                                <div className="absolute top-2 left-2">
                                  <input type="checkbox" checked={selectedBoxes.has(box.id)} onChange={()=> toggleSelect(box.id)} onClick={e=> e.stopPropagation()} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" aria-label={t('dashboard.box.selectAria',{name:box.name})} />
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium truncate pl-6" title={box.name}>{box.name}</p>
                                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                                  <span><span className="text-gray-500">{t('dashboard.box.label.created')}</span> {fmtDate(box.meta?.createdAt)}</span>
                                  <span><span className="text-gray-500">{t('dashboard.box.label.type')}</span> {box.meta?.boxType}</span>
                                  <span className="flex items-center gap-1"><span className="text-gray-500">{t('dashboard.box.label.securityAbbrev')}</span>{Array.from({length: box.meta?.securityKeys||1}).map((_,i)=>(<KeySquare key={i} className="w-3 h-3 text-amber-500" style={{filter:'drop-shadow(0 0 2px rgba(245,158,11,0.5))'}} title={box.meta?.securityKeys===1?t('dashboard.box.security.single'):t('dashboard.box.security.dual')} />))}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                                <span>{fmtBytes(box.bytes)} / {box.capacityKnown ? fmtBytes(box.capacity) : '?'} ({box.percent.toFixed(1)}%)</span>
                                <span>{box.files} file{box.files===1?'':'s'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  {(() => { const p = box.percent; const width = p>0 && p<1 ? '1%' : `${p}%`; return (
                                    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={t('dashboard.box.usage.aria',{percent:p.toFixed(1)})}>
                                      <div className="h-full" style={{ width, backgroundImage: buildGradient(p), transition:'width .3s ease' }} />
                                    </div>
                                  ); })()}
                                </div>
                                {box.critical ? <AlertTriangle className="w-4 h-4 text-red-600" title={t('dashboard.box.usage.critical')} /> : box.approaching ? <AlertTriangle className="w-4 h-4 text-amber-500" title={t('dashboard.box.usage.approaching')} /> : null}
                              </div>
                            </div>);
                          })
                        ) : (<p className="text-gray-500">{t('dashboard.empty.noMatches')}</p>)}
                      </div>
                    </div>
                  </div>
                  {/* Right Panel */}
                  <RightPanel user={user} usage={usage} selectedBoxes={selectedBoxes} selectedVaultId={selectedCompany} onSizeRangeFilter={handleSizeRangeFilter} />
                </div>
              </div>{/* flex-1 */}
            </div>{/* row */}
          </div>{/* wrapper */}
        </main>
      </div>
    </div>
  );
}

// (DistributionSamples moved into RightPanel in new design)
function SortCompact({ sortKey, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const parseSort = (key) => { const i = key.lastIndexOf('_'); return i>0 ? [key.slice(0,i), key.slice(i+1)] : [key,'desc']; };
  const [field, dir] = parseSort(sortKey || 'createdAt_desc');
  const OPTIONS_BASE = [
    ['createdAt',t('dashboard.sort.createdAt')],
    ['capacity',t('dashboard.sort.capacity')],
    ['used',t('dashboard.sort.used')],
    ['available',t('dashboard.sort.available')],
    ['security',t('dashboard.sort.security')],
    ['type',t('dashboard.sort.type')],
    ['name',t('dashboard.sort.name')]
  ];
  const labelFor = (f) => OPTIONS_BASE.find(o=> o[0]===f)?.[1] || f;
  const apply = (f, d) => onChange(`${f}_${d}`);
  const toggleDir = () => apply(field, dir==='desc'?'asc':'desc');
  return (
    <div className="relative inline-flex items-center gap-0.5 text-xs">
  <button type="button" onClick={()=> setOpen(o=>!o)} className="flex items-center gap-1 px-2 py-1 h-7 border border-gray-300 rounded hover:bg-gray-50" aria-haspopup="true" aria-expanded={open} title={t('dashboard.sort.fieldTitle')}>
        <ArrowDownUp className="w-3.5 h-3.5" />
        <span>{labelFor(field)}</span>
      </button>
  <button type="button" onClick={toggleDir} className="px-2 py-1 h-7 border border-gray-300 rounded hover:bg-gray-50 flex items-center" title={dir==='desc'?t('dashboard.sort.direction.desc'):t('dashboard.sort.direction.asc')} aria-label={t('dashboard.sort.toggleDirAria')}>
        {dir==='desc' ? <span className="leading-none text-[11px]">↓</span> : <span className="leading-none text-[11px]">↑</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-40 min-w-[6rem] py-1">
          {OPTIONS_BASE.map(([f,label]) => {
            const active = f===field;
            return (
              <button key={f} className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 flex items-center justify-between ${active?'bg-blue-50 text-blue-700':''}`} onClick={()=> { apply(f, f===field? dir : (f==='name' || f==='type' ? 'asc':'desc')); setOpen(false); }}>
                <span>{label}</span>
                {active && <span className="text-[10px] font-semibold">•</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
// Duplicate legacy implementation removed.
