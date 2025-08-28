package com.vaultedge.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.AccessDeniedException;
import java.nio.file.FileSystemException;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StorageService {

    @Value("${storage.root}")
    private String storageRoot;

    @Value("${upload.maxFileSizeBytes:2147483648}")
    private long configuredMaxUploadBytes;

    private Path root() {
        return Paths.get(storageRoot).toAbsolutePath().normalize();
    }

    public Path ensureUserRoot(String userId) throws IOException {
        // If a mapping exists (migration performed), use masked user id root under storageRoot
        try {
            StorageMappingStore store = new StorageMappingStore(root());
            var mapping = store.getUserMapping(userId);
            if (mapping != null && mapping.maskedUserId != null && !mapping.maskedUserId.isBlank()) {
                Path masked = root().resolve(mapping.maskedUserId).normalize();
                Files.createDirectories(masked);
                return masked;
            }
        } catch (Exception ignored) {
            // fallback to original behavior
        }
        Path userPath = root().resolve(userId).normalize();
        Files.createDirectories(userPath);
        return userPath;
    }

    public Path ensureSafeBox(String userId, String safeBoxName) throws IOException {
        Path userRoot = ensureUserRoot(userId);
        // If mapping exists, safeboxes are nested under RootVault/<maskedName>
        try {
            StorageMappingStore store = new StorageMappingStore(root());
            var mapping = store.getUserMapping(userId);
            if (mapping != null && mapping.safeboxes != null && mapping.safeboxes.containsKey(safeBoxName)) {
                String masked = mapping.safeboxes.get(safeBoxName);
                Path p = userRoot.resolve("RootVault").resolve(masked).normalize();
                Files.createDirectories(p);
                return p;
            }
        } catch (Exception ignored) { }
        Path sbPath = userRoot.resolve(safeBoxName).normalize();
        Files.createDirectories(sbPath);
        return sbPath;
    }

    public Path createSubfolder(String userId, String safeBoxName, String subfolder) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path sub = base.resolve(subfolder).normalize();
        if (!sub.startsWith(base)) throw new SecurityException("Invalid subfolder path");
        Files.createDirectories(sub);
    appendSafeBoxLog(userId, safeBoxName, "CREATE_FOLDER " + subfolder);
        return sub;
    }

    public Path saveFile(String userId, String safeBoxName, String relativePath, byte[] content) throws IOException {
        return saveFile(userId, safeBoxName, relativePath, content, null);
    }

    public Path saveFile(String userId, String safeBoxName, String relativePath, byte[] content, Long originalDateMs) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path target = base.resolve(relativePath).normalize();
        if (!target.startsWith(base)) throw new SecurityException("Invalid file path");
        // Enforce per-upload max size (configurable via property upload.maxFileSizeBytes; default 2GB if absent)
        long maxUpload = getMaxUploadBytes();
        if (content.length > maxUpload) {
            throw new IllegalArgumentException("File size " + content.length + " exceeds maximum allowed upload size of " + maxUpload + " bytes");
        }
        // Enforce remaining capacity of safebox
        long currentUsed = usage(userId, safeBoxName).usedBytes; // recompute to be safe
        long capacityBytes = pickCapacityBytes(safeBoxName);
        long remaining = capacityBytes - currentUsed;
        if (content.length > remaining) {
            throw new IllegalStateException("Not enough space in SafeBox. Remaining=" + remaining + " bytes, required=" + content.length + " bytes, capacity=" + capacityBytes + " bytes");
        }
        Files.createDirectories(target.getParent());
        Files.write(target, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        // Force update of last modified time to now to reflect replacements immediately
        try {
            Files.setLastModifiedTime(target, FileTime.from(Instant.now()));
        } catch (UnsupportedOperationException ignored) { }
        // Persist original client-side date if provided (as epoch millis) in a sidecar file: <file>.orig
        try {
            if (originalDateMs != null && originalDateMs > 0) {
                Path origPath = Paths.get(target.toString() + ".orig");
                Files.writeString(origPath, Long.toString(originalDateMs), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            }
        } catch (Exception ignored) { }
    appendSafeBoxLog(userId, safeBoxName, "UPLOAD_FILE " + relativePath);
        return target;
    }

    private long getMaxUploadBytes() {
        return configuredMaxUploadBytes > 0 ? configuredMaxUploadBytes : 2L * 1024 * 1024 * 1024;
    }

    public boolean exists(String userId, String safeBoxName) {
        return Files.exists(root().resolve(userId).resolve(safeBoxName));
    }

    public List<String> listSafeBoxes(String userId) throws IOException {
        // If user was migrated, mappings contain original safebox names (original -> masked).
        try {
            StorageMappingStore store = new StorageMappingStore(root());
            var mapping = store.getUserMapping(userId);
            if (mapping != null && mapping.safeboxes != null && !mapping.safeboxes.isEmpty()) {
                return mapping.safeboxes.keySet().stream().sorted().collect(Collectors.toList());
            }
        } catch (Exception ignored) {
            // fall back to filesystem listing
        }
        Path user = ensureUserRoot(userId);
        if (!Files.exists(user)) return List.of();
        try (var stream = Files.list(user)) {
            return stream
                    .filter(Files::isDirectory)
                    .map(p -> p.getFileName().toString())
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    public Node tree(String userId, String safeBoxName) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Node rootNode = new Node();
        rootNode.type = "folder";
        rootNode.name = base.getFileName().toString();
        rootNode.path = ""; // base
        rootNode.children = new ArrayList<>();

        Files.walkFileTree(base, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                if (dir.equals(base)) return FileVisitResult.CONTINUE;
                Node folder = new Node();
                folder.type = "folder";
                folder.name = dir.getFileName().toString();
                folder.path = base.relativize(dir).toString().replace('\\', '/');
                folder.children = new ArrayList<>();
                attachNode(folder);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                // Skip sidecar metadata files
                if (file.getFileName().toString().endsWith(".orig")) {
                    return FileVisitResult.CONTINUE;
                }
                Node f = new Node();
                f.type = "file";
                f.name = file.getFileName().toString();
                f.path = base.relativize(file).toString().replace('\\', '/');
                f.size = Files.size(file);
                f.modifiedAt = Files.getLastModifiedTime(file).toInstant();
                f.createdAt = attrs.creationTime() != null ? attrs.creationTime().toInstant() : null;
                // Read sidecar original date if available
                try {
                    Path origPath = Paths.get(file.toString() + ".orig");
                    if (Files.exists(origPath)) {
                        String txt = Files.readString(origPath, java.nio.charset.StandardCharsets.UTF_8).trim();
                        if (!txt.isEmpty()) {
                            long ms = Long.parseLong(txt);
                            f.originalDate = Instant.ofEpochMilli(ms);
                        }
                    }
                } catch (Exception ignored) { }
                attachNode(f);
                return FileVisitResult.CONTINUE;
            }

            private void attachNode(Node node) {
                String parent = node.path.contains("/") ? node.path.substring(0, node.path.lastIndexOf('/')) : "";
                Node parentNode = findOrCreate(parent);
                parentNode.children.add(node);
                parentNode.children.sort(Comparator.comparing((Node n) -> n.type).thenComparing(n -> n.name.toLowerCase()));
            }

            private Node findOrCreate(String relPath) {
                if (relPath.isEmpty()) return rootNode;
                String[] parts = relPath.split("/");
                Node current = rootNode;
                StringBuilder built = new StringBuilder();
                for (String part : parts) {
                    if (built.length() > 0) built.append('/');
                    built.append(part);
                    String p = built.toString();
                    Node next = current.children.stream()
                            .filter(n -> "folder".equals(n.type) && n.path.equals(p))
                            .findFirst()
                            .orElse(null);
                    if (next == null) {
                        next = new Node();
                        next.type = "folder";
                        next.name = part;
                        next.path = p;
                        next.children = new ArrayList<>();
                        current.children.add(next);
                    }
                    current = next;
                }
                return current;
            }
        });
        return rootNode;
    }

    public void deleteFile(String userId, String safeBoxName, String relativePath) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path target = base.resolve(relativePath).normalize();
        if (!target.startsWith(base)) throw new SecurityException("Invalid file path: " + relativePath);
        if (!Files.exists(target)) throw new IllegalArgumentException("File not found: " + relativePath);
        if (!Files.isRegularFile(target)) throw new IllegalArgumentException("Path is not a file: " + relativePath);
        long size = Files.size(target);
        boolean deleted = false;
        String failReason = null;
        for (int attempt = 1; attempt <= 3 && !deleted; attempt++) {
            try {
                Files.delete(target);
                deleted = true;
            } catch (AccessDeniedException ade) {
                failReason = "access denied"; // locked or insufficient rights
                // Try to clear DOS read-only attribute if present (Windows)
                try { Files.setAttribute(target, "dos:readonly", false); } catch (Exception ignored) { }
                // Backoff (progressive) before retrying
                try { Thread.sleep(120L * attempt); } catch (InterruptedException ignored) { }
            } catch (FileSystemException fse) {
                // Includes AccessDeniedException subclass but we handled it earlier; treat generically
                if (fse instanceof NoSuchFileException) {
                    deleted = true; // already gone
                } else {
                    failReason = "file is in use or locked";
                    try { Thread.sleep(150L * attempt); } catch (InterruptedException ignored) { }
                }
            } catch (IOException ioe) {
                failReason = "I/O error";
                break; // non-retryable generic I/O
            }
        }
        if (!deleted) {
            if (failReason == null) failReason = "unknown";
            throw new IllegalStateException("Failed to delete file (size=" + size + " bytes): " + relativePath + ". Reason: " + failReason);
        }
        // Best-effort cleanup of sidecar original date
        try {
            Path origPath = Paths.get(target.toString() + ".orig");
            if (Files.exists(origPath)) Files.delete(origPath);
        } catch (Exception ignored) { }
        appendSafeBoxLog(userId, safeBoxName, "DELETE_FILE " + relativePath);
    }

    public void deleteFolder(String userId, String safeBoxName, String relativePath) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path target = base.resolve(relativePath).normalize();
        if (!target.startsWith(base)) throw new SecurityException("Invalid folder path: " + relativePath);
        if (!Files.exists(target)) throw new IllegalArgumentException("Folder not found: " + relativePath);
        if (!Files.isDirectory(target)) throw new IllegalArgumentException("Path is not a folder: " + relativePath);
        // Do not allow deleting safebox root
        if (target.equals(base)) throw new IllegalArgumentException("Cannot delete safebox root");
        // Recursively delete contents
        // Best-effort retries on Windows locking issues
        IOException last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                Files.walk(target)
                        .sorted(Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                // Skip sidecar cleanup rules handled implicitly by deleting files
                                Files.deleteIfExists(p);
                            } catch (IOException e) {
                                throw new RuntimeException(e);
                            }
                        });
                appendSafeBoxLog(userId, safeBoxName, "DELETE_FOLDER " + relativePath);
                return;
            } catch (RuntimeException rte) {
                if (rte.getCause() instanceof IOException io) {
                    last = io;
                    try { Thread.sleep(150L * attempt); } catch (InterruptedException ignored) {}
                } else {
                    throw rte;
                }
            }
        }
        if (last != null) throw last;
    }

    // ===== Audit Log helpers =====
    private void appendUserLog(String userId, String message) throws IOException {
        Path userRoot = ensureUserRoot(userId);
        Path logFile = userRoot.resolve("usuario.log");
        String line = Instant.now().toString() + " " + message + System.lineSeparator();
        Files.writeString(logFile, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private void appendSafeBoxLog(String userId, String safeBoxName, String message) throws IOException {
        Path userRoot = ensureUserRoot(userId);
        Path logFile = userRoot.resolve(safeBoxName + ".log");
        String line = Instant.now().toString() + " " + message + System.lineSeparator();
        Files.writeString(logFile, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        // also reflect a summary line in user log referencing safebox
        appendUserLog(userId, safeBoxName + ": " + message);
        // Best-effort prune of safebox log based on retention setting
        try {
            int days = getRetentionDays(userId, safeBoxName);
            pruneSafeBoxLog(userRoot.resolve(safeBoxName + ".log"), days);
        } catch (Exception ignored) { }
    }

    private void pruneSafeBoxLog(Path logFile, int retentionDays) throws IOException {
        if (!Files.exists(logFile) || retentionDays <= 0) return;
        Instant threshold = Instant.now().minusSeconds((long) retentionDays * 24 * 60 * 60);
        List<String> lines = Files.readAllLines(logFile, StandardCharsets.UTF_8);
        List<String> kept = new ArrayList<>(lines.size());
        for (String line : lines) {
            if (line == null || line.isBlank()) continue;
            int idx = line.indexOf(' ');
            if (idx <= 0) continue;
            String ts = line.substring(0, idx);
            try {
                Instant t = Instant.parse(ts);
                if (!t.isBefore(threshold)) kept.add(line);
            } catch (Exception ignored) { kept.add(line); }
        }
        if (kept.size() != lines.size()) {
            Files.write(logFile, kept, StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.CREATE);
        }
    }

    // ===== Rename operations =====
    public void renameFile(String userId, String safeBoxName, String relativePath, String newName) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path src = base.resolve(relativePath).normalize();
        if (!src.startsWith(base)) throw new SecurityException("Invalid file path");
        if (!Files.exists(src) || !Files.isRegularFile(src)) throw new IllegalArgumentException("File not found: " + relativePath);
        if (!newName.matches(".+")) throw new IllegalArgumentException("New name required");
        Path parent = src.getParent();
        Path dest = parent.resolve(newName).normalize();
        if (!dest.startsWith(base)) throw new SecurityException("Invalid destination");
        if (Files.exists(dest)) throw new IllegalArgumentException("A file with that name already exists");
        Files.move(src, dest, StandardCopyOption.ATOMIC_MOVE);
        try { Files.setLastModifiedTime(dest, FileTime.from(Instant.now())); } catch (Exception ignored) {}
        appendSafeBoxLog(userId, safeBoxName, "RENAME_FILE " + base.relativize(src).toString().replace('\\','/') + " -> " + base.relativize(dest).toString().replace('\\','/'));
    }

    public void renameFolder(String userId, String safeBoxName, String relativePath, String newName) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        Path src = base.resolve(relativePath).normalize();
        if (!src.startsWith(base)) throw new SecurityException("Invalid folder path");
        if (!Files.exists(src) || !Files.isDirectory(src)) throw new IllegalArgumentException("Folder not found: " + relativePath);
        if (src.equals(base)) throw new IllegalArgumentException("Cannot rename safebox root");
        if (!newName.matches(".+")) throw new IllegalArgumentException("New name required");
        Path parent = src.getParent();
        Path dest = parent.resolve(newName).normalize();
        if (!dest.startsWith(base)) throw new SecurityException("Invalid destination");
        if (Files.exists(dest)) throw new IllegalArgumentException("A folder with that name already exists");
        Files.move(src, dest, StandardCopyOption.ATOMIC_MOVE);
        appendSafeBoxLog(userId, safeBoxName, "RENAME_FOLDER " + base.relativize(src).toString().replace('\\','/') + " -> " + base.relativize(dest).toString().replace('\\','/'));
    }

    // ===== Per-safebox retention setting =====
    public int getRetentionDays(String userId, String safeBoxName) throws IOException {
        Path userRoot = ensureUserRoot(userId);
        Path cfg = userRoot.resolve(safeBoxName + ".retention");
        int def = 30; // default days
        if (!Files.exists(cfg)) return def;
        try {
            String s = Files.readString(cfg, StandardCharsets.UTF_8).trim();
            int d = Integer.parseInt(s);
            if (d < 7) d = 7;
            return d;
        } catch (Exception ignored) {
            return def;
        }
    }

    public void setRetentionDays(String userId, String safeBoxName, int days) throws IOException {
        if (days < 7) days = 7;
        Path userRoot = ensureUserRoot(userId);
        Path cfg = userRoot.resolve(safeBoxName + ".retention");
        Files.writeString(cfg, Integer.toString(days), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        // After updating retention, prune immediately
        pruneSafeBoxLog(userRoot.resolve(safeBoxName + ".log"), days);
    }

    public void logCreateSafeBox(String userId, String safeBoxName) throws IOException {
        appendSafeBoxLog(userId, safeBoxName, "CREATE_SAFEBOX");
    }

    public List<AuditEntry> readAudit(String userId, Integer limit) throws IOException {
        Path userRoot = ensureUserRoot(userId);
        List<AuditEntry> entries = new ArrayList<>();
        if (Files.exists(userRoot) && Files.isDirectory(userRoot)) {
            try (var stream = Files.list(userRoot)) {
                List<Path> logs = stream.filter(p -> p.getFileName().toString().endsWith(".log")).collect(Collectors.toList());
                for (Path log : logs) {
                    String name = log.getFileName().toString();
                    boolean userLog = name.equals("usuario.log");
                    List<String> lines = Files.readAllLines(log, StandardCharsets.UTF_8);
                    for (String line : lines) {
                        if (line.isBlank()) continue;
                        int idx = line.indexOf(' ');
                        String ts = idx > 0 ? line.substring(0, idx) : Instant.now().toString();
                        String msg = idx > 0 ? line.substring(idx + 1) : line;
                        AuditEntry e = new AuditEntry();
                        e.scope = userLog ? "USER" : "SAFEBOX";
                        e.safeBoxName = userLog ? null : name.substring(0, name.length() - 4); // drop .log
                        e.timestamp = ts;
                        e.message = msg;
                        entries.add(e);
                    }
                }
            }
        }
        // sort descending by timestamp string (ISO) then trim
        entries.sort((a,b)-> b.timestamp.compareTo(a.timestamp));
        if (limit != null && limit > 0 && entries.size() > limit) {
            return entries.subList(0, limit);
        }
        return entries;
    }

    public AuditPage searchAudit(
            String userId,
            Instant from,
            Instant to,
            Set<String> scopes,
            Set<String> safeBoxes,
            String query,
            int page,
            int size
    ) throws IOException {
        List<AuditEntry> all = readAudit(userId, null);
        List<AuditEntry> filtered = new ArrayList<>();
        for (AuditEntry e : all) {
            // Timestamp
            try {
                Instant ts = Instant.parse(e.timestamp);
                if (from != null && ts.isBefore(from)) continue;
                if (to != null && ts.isAfter(to)) continue;
            } catch (Exception ignore) { /* keep if unparsable */ }
            // Scopes
            if (scopes != null && !scopes.isEmpty() && (e.scope == null || !scopes.contains(e.scope))) continue;
            // SafeBoxes (for USER scope lines, safebox may be in message prefix '<sb>: ')
            if (safeBoxes != null && !safeBoxes.isEmpty()) {
                String sb = e.safeBoxName;
                if (sb == null && e.scope != null && e.scope.equals("USER") && e.message != null) {
                    int idx = e.message.indexOf(':');
                    if (idx > 0) sb = e.message.substring(0, idx).trim();
                }
                if (sb == null || !safeBoxes.contains(sb)) continue;
            }
            // Query (substring match against message)
            if (query != null && !query.isBlank()) {
                String q = query.toLowerCase();
                String blob = ((e.message == null ? "" : e.message) + " " + (e.safeBoxName == null ? "" : e.safeBoxName)).toLowerCase();
                if (!blob.contains(q)) continue;
            }
            filtered.add(e);
        }
        int total = filtered.size();
        int fromIdx = Math.max(0, Math.min(page * size, total));
        int toIdx = Math.max(fromIdx, Math.min(fromIdx + size, total));
        List<AuditEntry> items = filtered.subList(fromIdx, toIdx);
        AuditPage ap = new AuditPage();
        ap.items = items;
        ap.total = total;
        ap.page = page;
        ap.size = size;
        return ap;
    }

    // ===== Usage / Capacity =====

    public SafeBoxUsage usage(String userId, String safeBoxName) throws IOException {
        Path base = ensureSafeBox(userId, safeBoxName);
        long bytes = 0L;
        long files = 0L;
        try (var walk = Files.walk(base)) {
            for (Path p : walk.collect(Collectors.toList())) {
                if (Files.isRegularFile(p)) {
                    if (p.getFileName().toString().endsWith(".orig")) continue; // skip sidecar
                    bytes += Files.size(p);
                    files++;
                }
            }
        }
        long capacityBytes = pickCapacityBytes(safeBoxName);
        SafeBoxUsage u = new SafeBoxUsage();
        u.safeBoxName = safeBoxName;
        u.usedBytes = bytes;
        u.fileCount = files;
        u.capacityBytes = capacityBytes;
        return u;
    }

    public List<SafeBoxUsage> usageAll(String userId) throws IOException {
        List<String> names = listSafeBoxes(userId);
        List<SafeBoxUsage> result = new ArrayList<>();
        for (String name : names) {
            try {
                result.add(usage(userId, name));
            } catch (IOException e) {
                // skip problematic safebox; continue with others
            }
        }
        return result;
    }

    private long pickCapacityBytes(String safeBoxName) {
        // Deterministic selection among: 1GB, 3GB, 5GB, 25GB, 100GB, 1TB
        long[] options = new long[]{
                1L << 30,            // 1 GB
                3L << 30,            // 3 GB
                5L << 30,            // 5 GB
                25L << 30,           // 25 GB
                100L << 30,          // 100 GB
                1L << 40             // 1 TB
        };
        int h = 0;
        for (int i = 0; i < safeBoxName.length(); i++) {
            h = (h * 31) + safeBoxName.charAt(i);
        }
        if (h < 0) h = -h;
        return options[h % options.length];
    }

    public static class Node {
        public String type; // file | folder
        public String name;
        public String path; // relative to safebox root using '/'
        public Long size; // only for files
        public Instant modifiedAt; // only for files
        public Instant createdAt; // only for files
        public Instant originalDate; // client-provided original date (e.g., file.lastModified)
        public List<Node> children; // only for folders
    }

    public static class SafeBoxUsage {
        public String safeBoxName;
        public long usedBytes;
        public long fileCount;
        public long capacityBytes;
    }

    public static class AuditEntry {
        public String scope; // USER or SAFEBOX
        public String safeBoxName; // null if USER scope
        public String timestamp; // ISO string
        public String message;
    }

    public static class AuditPage {
        public List<AuditEntry> items;
        public int total;
        public int page;
        public int size;
    }
}
