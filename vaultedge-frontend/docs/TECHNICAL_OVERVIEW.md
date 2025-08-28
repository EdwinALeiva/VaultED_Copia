# VaultEdge Frontend — Technical Overview

Date: 2025-08-12

## Architecture

- React + Vite SPA
- React Router for navigation
- Tailwind-like utility classes in JSX
- lucide-react icons
- Abortable API ops with progress via `storageApi`
- Toast notifications with `react-hot-toast`

## Core Components

- `SafeBoxDetail.jsx`
  - File operations: upload, replace, download, import (folder), delete, rename
  - Conflict handling:
    - Upload conflicts: batch modal
    - Import conflicts: per-file modal with “apply to all” (Replace/Keep both/Skip)
  - Capacity enforcement: `ensureCapacityForDelta`
  - Cancellable operations in all long-running flows
  - Right-side drawer: preview (images/pdf/text), metadata; placeholders for versions/audit
  - Popup progress bars centralize feedback; header duplicate Cancel/status removed

- `FileTree.jsx`
  - Compact tree; active folder emphasized

- `emailService.js`
  - Simulated session summary + file action emails

## UX Improvements

- Zebra striping and tighter table density
- Smaller fonts on FileTree and date/size columns
- Breadcrumbs and improved folder navigation

## Import Folder Flow

- Uses `showDirectoryPicker` when available, with fallback to `<input webkitdirectory>`
- Emulates `webkitRelativePath` for File System Access API picks
- Validates Include Subfolders setting; aborts when no files qualify
- Creates container folder; handles conflicts per file

## Known Gaps

- Real storage/auth integration pending
- Versions & audit tabs are placeholders
- Email delivery is simulated only
