import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, BarChart2, TrendingUp, Clock, Shield, AlertTriangle, KeySquare } from 'lucide-react';
import SafeBoxIcon from './SafeBoxIcon';
import { storageApi } from '../services/storageApi';
import { useI18n } from '../contexts/I18nContext';

// Skeleton RightPanel per PRP spec (KPI cards, visuals placeholders, renewals, approvals, security signals, alerts)
export default function RightPanel({ user, usage, selectedBoxes, selectedVaultId, onSizeRangeFilter }) {
  const { t } = useI18n();
  // First scope by selected vault (if any), then by selected boxes (intersection)
  const vaultScoped = useMemo(() => {
    if (!selectedVaultId || selectedVaultId === 'default') return usage;
    if (!user?.username) return usage;
    return usage.filter(b => {
      const assigned = localStorage.getItem(`safeboxVault:${user.username}:${b.id}`) || 'default';
      return assigned === selectedVaultId;
    });
  }, [usage, selectedVaultId, user?.username]);

  const activeUsage = useMemo(() => {
    if (selectedBoxes.size) {
      const set = selectedBoxes;
      return vaultScoped.filter(b => set.has(b.id));
    }
    return vaultScoped;
  }, [vaultScoped, selectedBoxes]);
  

  // Pending dual-key approvals (synthetic / stored in localStorage): key pattern vaultedge:approvals:<username>
  const approvals = useMemo(() => {
    if (!user?.username) return [];
    try {
      const raw = localStorage.getItem(`vaultedge:approvals:${user.username}`);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // Only keep approvals whose box still exists in active scope & box requires 2 keys
      const activeByName = Object.fromEntries(activeUsage.map(b => [b.name, b]));
      return arr.filter(a => activeByName[a.boxName] && (activeByName[a.boxName].meta?.securityKeys || 1) === 2)
        .map(a => ({ ...a, box: activeByName[a.boxName] }));
    } catch { return []; }
  }, [user?.username, activeUsage]);

  const kpis = useMemo(() => {
    if (!activeUsage.length) return null;
    const boxes = activeUsage.length;
    const usedBytes = activeUsage.reduce((s,b)=> s + b.bytes, 0);
    const capacityBytes = activeUsage.reduce((s,b)=> s + b.capacity, 0);
    const files = activeUsage.reduce((s,b)=> s + (b.files || 0), 0);
    const avgUtilPct = activeUsage.reduce((s,b)=> s + (b.percent||0), 0) / boxes;
    const overallUtilPct = capacityBytes ? (usedBytes / capacityBytes) * 100 : 0;
    const atRisk = activeUsage.filter(b => b.percent >= 80).length;
    const graceCount = activeUsage.filter(b => b.lifecycleStatus === 'GRACE').length;
    const blockedCount = activeUsage.filter(b => b.lifecycleStatus === 'BLOCKED').length;
    const pendingApprovals = approvals.length;
    return { boxes, usedBytes, capacityBytes, files, avgUtilPct, overallUtilPct, pendingApprovals, atRisk, graceCount, blockedCount };
  }, [activeUsage, approvals]);

  const [dist, setDist] = useState(null); // { ranges, totalBytes, totalFiles, top, boxesPerRange }
  const [loadingDist, setLoadingDist] = useState(false);
  const RANGE_DEFS = useMemo(() => [
    { key: 'R1', label: t('rightPanel.range.R1'), min: 0,                  max: 1*1024*1024 },
    { key: 'R2', label: t('rightPanel.range.R2'), min: 1*1024*1024+1,      max: 10*1024*1024 },
    { key: 'R3', label: t('rightPanel.range.R3'), min: 10*1024*1024+1,     max: 100*1024*1024 },
    { key: 'R4', label: t('rightPanel.range.R4'), min: 100*1024*1024+1,    max: 1024*1024*1024 },
    { key: 'R5', label: t('rightPanel.range.R5'), min: 1024*1024*1024+1,   max: 3*1024*1024*1024 },
    { key: 'R6', label: t('rightPanel.range.R6'), min: 3*1024*1024*1024+1, max: Infinity }
  ], [t]);
  const classifySize = useCallback((bytes) => {
    if (bytes < 1*1024*1024) return 'R1';
    if (bytes < 10*1024*1024) return 'R2';
    if (bytes < 100*1024*1024) return 'R3';
    if (bytes < 1024*1024*1024) return 'R4';
    if (bytes < 3*1024*1024*1024) return 'R5';
    return 'R6';
  }, []);
  const traverseTree = useCallback((node, acc, topPerRange, boxesPerRange, boxName) => {
    if (!node) return;
    if (node.type === 'file' && typeof node.size === 'number') {
      const key = classifySize(node.size);
      if (key) {
        acc[key] = acc[key] || { bytes: 0, files: 0 };
        acc[key].bytes += node.size; acc[key].files += 1;
        boxesPerRange[key] = boxesPerRange[key] || new Set();
        boxesPerRange[key].add(boxName);
        const N = 5; const arr = (topPerRange[key] = topPerRange[key] || []);
        if (arr.length < N) arr.push({ size: node.size, key, path: node.path, name: node.name });
        else { let mi=0; for (let i=1;i<arr.length;i++) if (arr[i].size < arr[mi].size) mi=i; if (node.size > arr[mi].size) arr[mi] = { size: node.size, key, path: node.path, name: node.name }; }
      }
    }
    if (node.children) node.children.forEach(ch => traverseTree(ch, acc, topPerRange, boxesPerRange, boxName));
  }, [classifySize]);
  useEffect(() => {
    if (!user?.username || !activeUsage.length) { setDist(null); return; }
    let aborted=false; (async () => {
      setLoadingDist(true);
      try {
        const perBox = await Promise.all(activeUsage.map(async b => {
          try { const tree = await storageApi.getTree(user.username, b.name); const acc={}; const top={}; const boxesPerRange={}; traverseTree(tree, acc, top, boxesPerRange, b.name); return { acc, top, boxesPerRange }; } catch { return {}; }
        }));
        if (aborted) return; const merged={}, mergedTop={}, mergedBoxes={};
        perBox.forEach(entry => { if (!entry.acc) return; Object.entries(entry.acc).forEach(([k,v])=>{ if(!merged[k]) merged[k]={bytes:0,files:0}; merged[k].bytes+=v.bytes; merged[k].files+=v.files; }); Object.entries(entry.top||{}).forEach(([rk, arr])=>{ mergedTop[rk]=(mergedTop[rk]||[]).concat(arr); }); Object.entries(entry.boxesPerRange||{}).forEach(([rk,set])=>{ mergedBoxes[rk]=mergedBoxes[rk]||new Set(); set.forEach(x=>mergedBoxes[rk].add(x)); }); });
        Object.keys(mergedTop).forEach(rk=>{ mergedTop[rk].sort((a,b)=> b.size - a.size); mergedTop[rk]=mergedTop[rk].slice(0,5); });
        const totalBytes = Object.values(merged).reduce((s,r)=> s + r.bytes,0); const totalFiles = Object.values(merged).reduce((s,r)=> s + r.files,0);
        setDist({ ranges: merged, totalBytes, totalFiles, top: mergedTop, boxesPerRange: mergedBoxes });
      } finally { if(!aborted) setLoadingDist(false); }
    })(); return () => { aborted=true; };
  }, [activeUsage, user?.username, traverseTree]);
  // Prepare distribution segments (files based) for stacked bar
  const distSegments = useMemo(() => {
    if (!dist || !dist.totalFiles) return [];
    const COLORS = { R1:'#16a34a', R2:'#22c55e', R3:'#84cc16', R4:'#f59e0b', R5:'#f97316', R6:'#dc2626' };
    const raw = RANGE_DEFS.map(r => {
      const d = dist.ranges[r.key];
      if (!d) return null;
      const pct = (d.files / dist.totalFiles) * 100;
      return { key: r.key, pct, color: COLORS[r.key], label: r.label, files: d.files };
    }).filter(Boolean);
    // Ensure a minimum visible width so labels fit (except if only one segment)
    const MIN = 6; // percent
    const active = raw.length;
    if (active > 1) {
      let deficit = 0;
      raw.forEach(seg => { if (seg.pct > 0 && seg.pct < MIN) { deficit += (MIN - seg.pct); seg._boosted = true; seg.pct = MIN; } });
      if (deficit > 0) {
        // Reduce from large segments proportionally
        let reducible = raw.filter(s => !s._boosted).reduce((s,x)=> s + (x.pct - MIN), 0); // potential after keeping MIN
        if (reducible > 0) {
          raw.forEach(seg => {
            if (!seg._boosted && seg.pct > MIN) {
              const share = (seg.pct - MIN) / reducible; // fraction of reducible pool
              const cut = share * deficit;
              seg.pct = Math.max(MIN, seg.pct - cut);
            }
          });
        }
        // Normalize to 100
        const total = raw.reduce((s,x)=> s + x.pct,0);
        raw.forEach(seg => { seg.pct = seg.pct / total * 100; });
      }
    }
    return raw;
  }, [dist, RANGE_DEFS]);
  const fmtBytes = (bytes) => { if(bytes==null) return '0 B'; const u=['B','KB','MB','GB','TB']; let v=bytes,i=0; while(v>=1024 && i<u.length-1){v/=1024;i++;} return `${v.toFixed(v>=10||i===0?0:1)} ${u[i]}`; };
  const COLORS = { R1:'#16a34a', R2:'#22c55e', R3:'#84cc16', R4:'#f59e0b', R5:'#f97316', R6:'#dc2626' };
  // Build alerts (capacity + lifecycle + approvals)
  const alerts = useMemo(()=> {
    const list = [];
    const now = Date.now();
    activeUsage.forEach(b => {
      if (b.percent >= 25) {
        let severity='NOTICE';
        if (b.percent>=95) severity='CRITICAL'; else if (b.percent>=80) severity='WARNING';
  list.push({ id: b.id+':cap', name: b.name, type: 'CAPACITY', detail: t('rightPanel.alerts.capacityDetail',{percent: b.percent.toFixed(1)}), severity, sortWeight: 3, metric: b.percent });
      }
      if (b.lifecycleStatus === 'RENEWAL_SOON') {
        const days = Math.ceil((b.renewalDueAt - now)/86400000);
  list.push({ id: b.id+':renew', name: b.name, type: 'RENEWAL_SOON', detail: t('rightPanel.alerts.renewSoonDetail',{days}), severity: 'WARNING', sortWeight: 2, metric: days });
      } else if (b.lifecycleStatus === 'GRACE') {
        const days = Math.ceil((b.renewalGraceEndAt - now)/86400000);
  list.push({ id: b.id+':grace', name: b.name, type: 'GRACE', detail: t('rightPanel.alerts.graceDetail',{days}), severity: 'CRITICAL', sortWeight: 1, metric: days });
      } else if (b.lifecycleStatus === 'BLOCKED') {
  list.push({ id: b.id+':blocked', name: b.name, type: 'BLOCKED', detail: t('rightPanel.alerts.blockedDetail'), severity: 'CRITICAL', sortWeight: 0, metric: 0 });
      }
    });
    approvals.forEach(a => {
  list.push({ id: a.box.id + ':approval:' + (a.id||a.createdAt||'') , name: a.box.name, type: 'APPROVAL', detail: t('rightPanel.alerts.approvalDetail',{action: a.type || 'Action'}), severity: 'WARNING', sortWeight: 2.2, metric: (a.createdAt ? Date.now() - a.createdAt : 0) });
    });
    const sevRank = { CRITICAL:3, WARNING:2, NOTICE:1 };
    list.sort((a,b)=> {
      if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
      if (sevRank[b.severity] !== sevRank[a.severity]) return sevRank[b.severity] - sevRank[a.severity];
      return a.metric - b.metric;
    });
    return list;
  }, [activeUsage, approvals, t]);
  const topBoxes = useMemo(()=> activeUsage.map(b=>({ id:b.id,name:b.name, util: b.capacity? (b.bytes/b.capacity)*100:0 })).sort((a,b)=> b.util-a.util).slice(0,5), [activeUsage]);
  const handleSliceClick = (rangeKey) => { if (!dist?.boxesPerRange?.[rangeKey]) return; onSizeRangeFilter && onSizeRangeFilter(rangeKey, new Set(Array.from(dist.boxesPerRange[rangeKey]))); };
  return (
    <div className="flex flex-col gap-4 w-full 2xl:w-1/2">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
    <KpiCard icon={<SafeBoxIcon size={16} />} label={t('rightPanel.kpi.totalBoxes')} value={kpis?.boxes||0} secondary="30d Δ —" />
  <KpiCard icon={<BarChart2 size={16} />} label={t('rightPanel.kpi.usedCap')} value={`${fmtBytes(kpis?.usedBytes||0)} / ${fmtBytes(kpis?.capacityBytes||0)}`} secondary={t('rightPanel.kpi.usedCap.secondary',{avg:(kpis?.avgUtilPct||0).toFixed(1)})}>
          <UtilGauge pct={kpis?.overallUtilPct||0} />
        </KpiCard>
  <KpiCard icon={<Box size={16} />} label={t('rightPanel.kpi.activeFiles')} value={kpis?.files||0} secondary={t('rightPanel.kpi.activeFiles.secondary',{count:0})} />
  <KpiCard icon={<Clock size={16} />} label={t('rightPanel.kpi.approvalsPending')} value={kpis?.pendingApprovals||0} secondary={t('rightPanel.kpi.approvalsPending.secondary')} />
  <KpiCard icon={<TrendingUp size={16} />} label={t('rightPanel.kpi.atRisk')} value={kpis?.atRisk||0} secondary={t('rightPanel.kpi.atRisk.secondary')} />
  <KpiCard icon={<Shield size={16} />} label={t('rightPanel.kpi.blockedGrace')} value={`${kpis?.blockedCount||0} / ${kpis?.graceCount||0}`} secondary={t('rightPanel.kpi.blockedGrace.secondary')} />
      </div>
      <div className="bg-white rounded shadow p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('rightPanel.distribution.title')}</h2>
          {dist?.totalFiles ? <span className="text-[10px] text-gray-500">{t('rightPanel.distribution.filesLabel',{count:dist.totalFiles})}</span> : null}
        </div>
  {loadingDist ? <p className="text-xs text-gray-500">{t('rightPanel.distribution.calculating')}</p> : !dist?.totalFiles ? <p className="text-xs text-gray-500">{t('rightPanel.distribution.empty')}</p> : (
          <div className="flex flex-col gap-2">
            <div className="w-full h-7 rounded overflow-hidden flex shadow-inner ring-1 ring-gray-200">
              {distSegments.map(seg => {
                const pctLabel = seg.pct < 0.1 ? '<0.1%' : seg.pct.toFixed(1) + '%';
                return (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => handleSliceClick(seg.key)}
                    style={{ width: seg.pct + '%', backgroundColor: seg.color, minWidth: '34px' }}
                    className="group relative h-full focus:outline-none focus:ring-1 focus:ring-black/40"
                    title={`${seg.key}: ${seg.label} (${seg.files} ${t('dashboard.files.plural')}, ${pctLabel})`}
                    aria-label={t('rightPanel.filter.aria',{label:seg.label})}
                  >
                    {/* Center now shows percentage */}
                    {seg.pct > 3 && (
                      <span className="absolute inset-0 flex items-center justify-center px-0.5 text-[9px] font-semibold tracking-wide text-white drop-shadow-sm">
                        {pctLabel}
                      </span>
                    )}
                    {/* Removed range key label per request */}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {distSegments.map(seg => (
                <button
                  key={seg.key+ '-legend'}
                  onClick={() => handleSliceClick(seg.key)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] hover:bg-gray-50"
                  style={{ borderColor: seg.color }}
                  title={`${seg.key}: ${seg.label}`}
                >
                  <span className="inline-block w-2 h-2 rounded" style={{ background: seg.color }} />
                  <span className="font-medium">{seg.key}</span>
                  <span className="text-gray-600 truncate max-w-[90px]" title={seg.label}>{seg.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded p-2">
            <h3 className="text-[11px] font-semibold mb-1">{t('rightPanel.trend.title')}</h3>
            <p className="text-[10px] text-gray-500">{t('rightPanel.trend.placeholder')}</p>
          </div>
          <div className="border rounded p-2">
            <h3 className="text-[11px] font-semibold mb-1">{t('rightPanel.top5.title')}</h3>
            <ul className="space-y-1">
              {topBoxes.map(tb => <li key={tb.id} className="text-[10px] flex items-center gap-2"><span className="flex-1 truncate" title={tb.name}>{tb.name}</span><span className={`px-1 rounded text-[9px] ${tb.util>=95?'bg-red-100 text-red-700': tb.util>=80?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-700'}`}>{tb.util.toFixed(1)}%</span></li>)}
              {!topBoxes.length && <li className="text-[10px] text-gray-500">{t('rightPanel.top5.empty')}</li>}
            </ul>
          </div>
        </div>
      </div>
  {/* Alerts */}
  <div className="bg-white rounded shadow p-4"><h2 className="text-sm font-semibold mb-2">{t('rightPanel.alerts.title')}</h2>{!alerts.length? <p className="text-[11px] text-gray-500">{t('rightPanel.alerts.empty')}</p>: <ul className="space-y-1 text-[11px]">{alerts.map(a=>{ const badgeClass= a.severity==='CRITICAL'?'bg-red-50 text-red-700 border-red-200': a.severity==='WARNING'?'bg-amber-50 text-amber-700 border-amber-200': 'bg-blue-50 text-blue-700 border-blue-200'; const icon = a.type==='BLOCKED' || a.type==='GRACE' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : a.type==='RENEWAL_SOON' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : a.type==='APPROVAL' ? <KeySquare className="w-4 h-4 text-blue-600" /> : <AlertTriangle className={`w-4 h-4 ${a.severity==='CRITICAL'?'text-red-600': a.severity==='WARNING'?'text-amber-500':'text-blue-500'}`} />; return (<li key={a.id} className="flex items-center gap-2"><span>{icon}</span><span className="flex-1 truncate" title={a.name}>{a.name}</span><span className="text-[10px] text-gray-500 truncate max-w-[140px]" title={a.detail}>{a.detail}</span><span className={`px-1 py-0.5 rounded text-[9px] font-medium tracking-wide border ${badgeClass}`}>{a.severity}</span></li>); })}</ul>}</div>
    </div>
  );
}
function KpiCard({ icon, label, value, secondary, children }) { return (<div className="bg-white rounded shadow p-3 flex flex-col gap-1"><div className="flex items-center gap-2 text-[11px] text-gray-600"><span className="text-gray-700">{icon}</span><span className="font-medium">{label}</span></div><div className="text-lg font-semibold leading-none truncate">{value}</div>{children && <div>{children}</div>}{secondary && <div className="text-[10px] text-gray-500">{secondary}</div>}</div>); }

function UtilGauge({ pct }) {
  const capped = Math.min(100, Math.max(0, pct));
  const color = capped >= 95 ? 'bg-red-500' : capped >= 80 ? 'bg-amber-500' : capped >= 60 ? 'bg-yellow-400' : capped >= 40 ? 'bg-green-500' : 'bg-green-400';
  return (
    <div className="mt-1">
      <div className="h-2 w-full rounded bg-gray-100 overflow-hidden relative">
        <div className={`h-full ${color}`} style={{ width: capped + '%' }} />
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-gray-700 mix-blend-multiply">{capped.toFixed(1)}%</div>
      </div>
      <div className="flex justify-between text-[8px] mt-0.5 text-gray-500 tracking-wide">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}
