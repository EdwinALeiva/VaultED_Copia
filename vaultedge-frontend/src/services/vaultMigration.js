// src/services/vaultMigration.js
// Small client-side migration helper to create a demo folder-structure mapping in localStorage
export function maskId(input) {
  try {
    // simple deterministic masking: base64url of input then trim padding
    const b = typeof input === 'string' ? input : JSON.stringify(input || '');
    return btoa(unescape(encodeURIComponent(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch { return `m_${Math.abs((input||'').length || 0)}`; }
}

export function buildFolderStructureForUser(username) {
  if (!username) return null;
  // Gather existing safebox registry entries for this user
  try {
    const registryRaw = localStorage.getItem(`vaultedge:safeboxRegistry:${username}`) || '{}';
    const registry = JSON.parse(registryRaw || '{}');
    // registry maps originalName -> [ids]
    const entries = [];
    for (const [name, ids] of Object.entries(registry || {})) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        const masked = maskId(id).slice(0, 12);
        entries.push({ id, originalName: name, maskedName: masked });
      }
    }
    // If no registry found, try discover safeboxMeta keys
    if (!entries.length) {
      for (let i=0;i<localStorage.length;i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const m = k.match(new RegExp(`^safeboxMeta:${username}:(.+)$`));
        if (m) {
          const id = m[1];
          const masked = maskId(id).slice(0,12);
          entries.push({ id, originalName: id, maskedName: masked });
        }
      }
    }

    const maskedUser = maskId(username).slice(0,12);
    const structure = {
      maskedUserId: maskedUser,
      root: 'Root Vault',
      safeboxes: entries
    };
    try { localStorage.setItem(`vaultedge:folderStructure:${username}`, JSON.stringify(structure)); } catch (e) { console.warn('failed to write folderStructure', e); }
    return structure;
  } catch (e) {
    console.warn('failed buildFolderStructureForUser', e);
    return null;
  }
}

export function migrateUserToVaultFolders(username) {
  return buildFolderStructureForUser(username);
}
