// simple safebox registry to map safebox occurrences (by name) to stable internal ids per user

const registryKey = (username) => `vaultedge:safeboxRegistry:${username}`;

function readRegistry(username) {
  try {
    const raw = localStorage.getItem(registryKey(username)) || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeRegistry(username, arr) {
  try { localStorage.setItem(registryKey(username), JSON.stringify(arr)); } catch { /* ignore */ }
}

function genId() {
  return `sb_${Date.now()}_${Math.floor(Math.random()*9000)+1000}`;
}

/**
 * Ensure registry has entries matching the provided names array.
 * Returns an array of ids aligned to the names order.
 */
export function ensureRegistryForNames(username, namesArray) {
  if (!username) return namesArray.map(() => '') ;
  const names = Array.isArray(namesArray) ? namesArray : [];
  const registry = readRegistry(username);

  // Group existing entries by name
  const byName = {};
  registry.forEach(entry => {
    if (!byName[entry.name]) byName[entry.name] = [];
    byName[entry.name].push(entry);
  });

  // Count occurrences of each name in names array
  const counts = {};
  names.forEach(n => { counts[n] = (counts[n] || 0) + 1; });

  // Ensure registry has at least counts[n] entries for each name
  Object.entries(counts).forEach(([name, cnt]) => {
    const have = (byName[name] || []).length;
    for (let i = have; i < cnt; i++) {
      const id = genId();
      const newEntry = { id, name, createdAt: new Date().toISOString() };
      registry.push(newEntry);
      if (!byName[name]) byName[name] = [];
      byName[name].push(newEntry);
    }
  });

  // Now for each name in the original order, pop one id from byName[name]
  const resultIds = [];
  const pointers = {};
  names.forEach((name) => {
    const arr = byName[name] || [];
    const ptr = pointers[name] || 0;
    const entry = arr[ptr];
    if (entry) {
      resultIds.push(entry.id);
      pointers[name] = ptr + 1;
    } else {
      // fallback: generate
      const id = genId();
      const newEntry = { id, name, createdAt: new Date().toISOString() };
      registry.push(newEntry);
      resultIds.push(id);
      if (!byName[name]) byName[name] = [];
      byName[name].push(newEntry);
      pointers[name] = (pointers[name] || 0) + 1;
    }
  });

  // Save updated registry
  writeRegistry(username, registry);
  return resultIds;
}

export function getRegistry(username) {
  return readRegistry(username);
}

export function getIdForNameOccurrence(username, name, occurrenceIndex = 0) {
  const reg = readRegistry(username).filter(r => r.name === name);
  if (reg.length > occurrenceIndex) return reg[occurrenceIndex].id;
  return null;
}
