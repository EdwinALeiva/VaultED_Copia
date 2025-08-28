# Demo Cloud Storage Simulation (Filesystem-backed)

Root: `storage.root` (e.g., `C:/Users/edomi/OneDrive/Documents/myCloudSimulation`)

- Per-user root: `<root>/<userId>` (userId: use username for demo; in production use UUID)
- SafeBox: `<root>/<userId>/<safeBoxName>` (safeBoxName is human label; sanitize names)
- Subfolders/files: any nested structure under the safebox
- Security: paths normalized; reject traversal attempts; future: per-user auth + ACLs

## Endpoints (prefix `/api/storage`)
- POST `/users/{userId}` → ensure user root exists
- GET `/users/{userId}/safeboxes` → list safebox directory names
- POST `/users/{userId}/safeboxes?name=...` → create safebox directory
- GET `/users/{userId}/safeboxes/{safeBoxName}/tree` → JSON directory tree
- POST `/users/{userId}/safeboxes/{safeBoxName}/folders?name=...` → create subfolder
- POST `/users/{userId}/safeboxes/{safeBoxName}/files` (multipart, fields: path, file) → upload file
- GET `/users/{userId}/safeboxes/{safeBoxName}/files?path=...` → download file (binary)
- DELETE `/users/{userId}/safeboxes/{safeBoxName}/files?path=...` → delete file

## Node JSON Structure
```
{
  "type": "folder" | "file",
  "name": "string",
  "path": "relative/to/safebox",
  "size": 123,              // for files
  "modifiedAt": "...",     // ISO instant, for files
  "children": [Node]        // for folders
}
```

## Conventions & Notes
- Use forward slashes in `path` values; backend converts safely.
- For demo, userId = username; real app will use UUIDs and map labels.
- SafeBoxName is user-provided, shown in UI; validate to avoid illegal filename chars on Windows.
- Directory ZIP and presigned URLs are out of scope for this demo; to be added in production path.
