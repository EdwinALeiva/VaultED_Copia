// src/services/mockApi.js
const safeBoxes = [
  { id: 1, name: 'Proyecto Financiero Alfa', createdAt: '2025-07-20' },
  { id: 2, name: 'Caja Principal', createdAt: '2025-07-18' },
  { id: 3, name: 'Source Code Backup', createdAt: '2025-07-15' },
];

const users = [
  { username: 'demo', password: '123', role: 'USER' },
];

function genFiles(count, prefix, parentId) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    name: `${prefix}_${i + 1}.txt`,
    type: 'file',
    parentId,
  }));
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

export const mockApi = {
  getSafeBoxes() {
    return Promise.resolve([...safeBoxes]);
  },

  getFileTree(boxId) {
    const box = safeBoxes.find((b) => b.id === boxId);
    if (!box) return Promise.resolve([]);

    let tree = [];

    if (boxId === 1) {
      tree = [
        {
          id: '1-root',
          name: box.name,
          type: 'folder',
          children: [
            { id: '1-file1', name: 'contract_alpha.pdf', type: 'file', parentId: '1-root' },
            { id: '1-file2', name: 'payment_source.java', type: 'file', parentId: '1-root' },
          ],
        },
      ];
    } else if (boxId === 2) {
      tree = [
        {
          id: '2-root',
          name: box.name,
          type: 'folder',
          children: [
            {
              id: '2-src',
              name: 'src',
              type: 'folder',
              parentId: '2-root',
              children: genFiles(5, 'src', '2-src'),
            },
            {
              id: '2-dist',
              name: 'dist',
              type: 'folder',
              parentId: '2-root',
              children: genFiles(5, 'dist', '2-dist'),
            },
          ],
        },
      ];
    } else if (boxId === 3) {
      tree = [
        {
          id: '3-root',
          name: box.name,
          type: 'folder',
          children: [
            {
              id: '3-app',
              name: 'app',
              type: 'folder',
              parentId: '3-root',
              children: [
                {
                  id: '3-app-components',
                  name: 'components',
                  type: 'folder',
                  parentId: '3-app',
                  children: genFiles(5, 'cmp', '3-app-components'),
                },
              ],
            },
          ],
        },
      ];
    } else {
      tree = [
        {
          id: `${boxId}-root`,
          name: box.name,
          type: 'folder',
          children: [],
        },
      ];
    }

    return Promise.resolve(tree);
  },

  login({ username, password }) {
    const user = users.find((u) => u.username === username);
    if (!user) {
      return Promise.reject({ status: 404, message: 'User does not exist' });
    }
    if (user.password !== password) {
      return Promise.reject({ status: 401, message: 'Invalid password' });
    }
    return Promise.resolve({ token: 'mock-token', role: user.role });
  },

  addFile(boxId, file) {
    return Promise.resolve({ ...file, id: uid() });
  },

  addSafeBox(name) {
    const newId = safeBoxes.length + 1;
    safeBoxes.push({
      id: newId,
      name,
      createdAt: new Date().toISOString().split('T')[0],
    });
    return Promise.resolve(newId);
  },
};
