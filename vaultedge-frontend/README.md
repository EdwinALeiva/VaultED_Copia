# VaultEdge Frontend

React + Vite single-page app for VaultEdge file management.

## Key features (today’s updates)

- Audit Log: inline Message search with filter icon; export/email aligned
- Sidebar/Dashboard: reordered menu; dashboard refresh event
- Report a Bug: environment capture, session drafts, close/submit flows
- Safe Box creation: select security type and capacity; dashboard uses selected size
- Capacity checks: pre-upload/import validation via `ensureCapacityForDelta`
- Cancellable operations: uploads/downloads/imports with AbortController; Cancel inside progress popups
- Import Folder:
  - Robust picker (File System Access API fallback)
  - Per-file conflict prompts with “apply to all” (replace/keep both/skip)
  - Batch container folder creation; respects Include subfolders
- UI polish: sky-blue zebra rows; compact tables; smaller FileTree font; bold active folder
- Right-side drawer: preview, metadata, placeholders for versions/audit
- Email summaries: per session or on logout (simulated via `emailService`)

## Run locally

```bash
npm install
npm run dev
```

Default: http://localhost:5173

## Import folder flow

1. Navigate to a Safe Box and a target folder.
2. Click Import Folder. Choose a folder using the OS picker.
3. In the popup, choose whether to include subfolders.
	- If Include subfolders is off and no files qualify, a message is shown and import is aborted.
4. If name conflicts occur, a per-file modal is shown with options:
	- Replace, Keep both, or Skip; optionally “Apply to all” for remaining conflicts.
5. Progress and Cancel are shown in the popup (not duplicated on the page).

## Capacity validation

- Client-side checks block actions that would exceed capacity, prioritizing local metadata when present.

## Security notes

- Hardened backend defaults: CSP, XSS protection, stateless sessions, hashed passwords.

## Structure

- `src/components/SafeBoxDetail.jsx`: main file manager UI & logic (uploads, downloads, replace, import, conflicts, drawer, settings).
- `src/components/FileTree.jsx`: folder tree with active folder styles and context actions.
- `src/services/storageApi.js`: API integration with progress + cancellation.
- `src/services/emailService.js`: simulated email notifications and session summaries.

## Next steps

- Wire real storage endpoints and auth
- Add per-file version history and audit tabs
- Integrate real email delivery
