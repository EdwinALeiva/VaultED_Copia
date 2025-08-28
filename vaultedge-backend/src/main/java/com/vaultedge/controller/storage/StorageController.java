package com.vaultedge.controller.storage;

import com.vaultedge.service.StorageService;
import com.vaultedge.service.StorageService.Node;
import com.vaultedge.service.StorageService.SafeBoxUsage;
import com.vaultedge.service.StorageService.AuditEntry;
import com.vaultedge.service.StorageService.AuditPage;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/storage")
public class StorageController {

    private final StorageService storageService;

    public StorageController(StorageService storageService) {
        this.storageService = storageService;
    }

    // Ensure user root exists (simulate user provisioning)
    @PostMapping("/users/{userId}")
    public ResponseEntity<String> ensureUser(@PathVariable @NotBlank String userId) throws IOException {
        storageService.ensureUserRoot(userId);
        return ResponseEntity.ok("User storage ready");
    }

    // List all safeboxes for a user
    @GetMapping("/users/{userId}/safeboxes")
    public ResponseEntity<List<String>> listSafeBoxes(@PathVariable String userId) throws IOException {
        return ResponseEntity.ok(storageService.listSafeBoxes(userId));
    }

    // Create a safebox (folder) for user
    @PostMapping("/users/{userId}/safeboxes")
    public ResponseEntity<String> createSafeBox(
            @PathVariable String userId,
            @RequestParam("name") String safeBoxName) throws IOException {
        if (!StringUtils.hasText(safeBoxName)) return ResponseEntity.badRequest().body("SafeBox name required");
    storageService.ensureSafeBox(userId, safeBoxName);
    storageService.logCreateSafeBox(userId, safeBoxName);
        return ResponseEntity.ok("SafeBox created");
    }

    // Usage for all safeboxes of a user
    @GetMapping("/users/{userId}/safeboxes/usage")
    public ResponseEntity<List<SafeBoxUsage>> usageAll(@PathVariable String userId) throws IOException {
        return ResponseEntity.ok(storageService.usageAll(userId));
    }

    // Usage for a single safebox
    @GetMapping("/users/{userId}/safeboxes/{safeBoxName}/usage")
    public ResponseEntity<SafeBoxUsage> usageOne(
            @PathVariable String userId,
            @PathVariable String safeBoxName) throws IOException {
        if (!storageService.exists(userId, safeBoxName)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(storageService.usage(userId, safeBoxName));
    }

    // Get the tree structure (files and folders) of a safebox
    @GetMapping("/users/{userId}/safeboxes/{safeBoxName}/tree")
    public ResponseEntity<Node> getTree(
            @PathVariable String userId,
            @PathVariable String safeBoxName) throws IOException {
        return ResponseEntity.ok(storageService.tree(userId, safeBoxName));
    }

    // Create a subfolder under a safebox
    @PostMapping("/users/{userId}/safeboxes/{safeBoxName}/folders")
    public ResponseEntity<String> createSubfolder(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("name") String folderName) throws IOException {
        if (!StringUtils.hasText(folderName)) return ResponseEntity.badRequest().body("Folder name required");
        storageService.createSubfolder(userId, safeBoxName, folderName);
        return ResponseEntity.ok("Folder created");
    }

    // Rename a folder (same parent)
    @PutMapping("/users/{userId}/safeboxes/{safeBoxName}/folders/rename")
    public ResponseEntity<String> renameFolder(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath,
            @RequestParam("newName") String newName) throws IOException {
        try {
            storageService.renameFolder(userId, safeBoxName, relativePath, newName);
            return ResponseEntity.ok("Folder renamed");
        } catch (IllegalArgumentException | IllegalStateException | SecurityException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    // Delete a folder (and all its contents) in a safebox
    @DeleteMapping("/users/{userId}/safeboxes/{safeBoxName}/folders")
    public ResponseEntity<Void> deleteFolder(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath) throws IOException {
        try {
            storageService.deleteFolder(userId, safeBoxName, relativePath);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException | IllegalStateException | SecurityException ex) {
            return ResponseEntity.badRequest().header("X-Error-Reason", ex.getMessage()).build();
        }
    }

    // Upload a file to a safebox (relative path optional to create nested folders)
    @PostMapping(value = "/users/{userId}/safeboxes/{safeBoxName}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> upload(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "originalDateMs", required = false) Long originalDateMs) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("Empty file");
        try {
            storageService.saveFile(userId, safeBoxName, relativePath, file.getBytes(), originalDateMs);
            return ResponseEntity.ok(relativePath);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body("Upload failed: " + ex.getMessage());
        }
    }

    // Delete a file in a safebox
    @DeleteMapping("/users/{userId}/safeboxes/{safeBoxName}/files")
    public ResponseEntity<Void> delete(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath) throws IOException {
        try {
            storageService.deleteFile(userId, safeBoxName, relativePath);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException | IllegalStateException | SecurityException ex) {
            return ResponseEntity.badRequest().header("X-Error-Reason", ex.getMessage()).build();
        }
    }

    // Rename a file (same parent)
    @PutMapping("/users/{userId}/safeboxes/{safeBoxName}/files/rename")
    public ResponseEntity<String> renameFile(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath,
            @RequestParam("newName") String newName) throws IOException {
        try {
            storageService.renameFile(userId, safeBoxName, relativePath, newName);
            return ResponseEntity.ok("File renamed");
        } catch (IllegalArgumentException | IllegalStateException | SecurityException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    // Read audit log entries (user + safebox logs). Optional ?limit=100
    @GetMapping("/users/{userId}/audit")
    public ResponseEntity<List<AuditEntry>> audit(
            @PathVariable String userId,
            @RequestParam(value = "limit", required = false) Integer limit) throws IOException {
        return ResponseEntity.ok(storageService.readAudit(userId, limit));
    }

    // Search audit with optional filters and pagination
    @GetMapping("/users/{userId}/audit/search")
    public ResponseEntity<AuditPage> auditSearch(
            @PathVariable String userId,
            @RequestParam(value = "from", required = false) String fromIso,
            @RequestParam(value = "to", required = false) String toIso,
            @RequestParam(value = "scopes", required = false) List<String> scopes,
            @RequestParam(value = "safeboxes", required = false) List<String> safeboxes,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "200") int size
    ) throws IOException {
        java.time.Instant from = null;
        java.time.Instant to = null;
        try { if (fromIso != null && !fromIso.isBlank()) from = java.time.Instant.parse(fromIso); } catch (Exception ignored) {}
        try { if (toIso != null && !toIso.isBlank()) to = java.time.Instant.parse(toIso); } catch (Exception ignored) {}
        java.util.Set<String> scopeSet = (scopes == null || scopes.isEmpty()) ? java.util.Set.of() : new java.util.HashSet<>(scopes);
        java.util.Set<String> sbSet = (safeboxes == null || safeboxes.isEmpty()) ? java.util.Set.of() : new java.util.HashSet<>(safeboxes);
        if (size <= 0) size = 200;
        if (page < 0) page = 0;
        AuditPage result = storageService.searchAudit(userId, from, to, scopeSet, sbSet, q, page, size);
        return ResponseEntity.ok(result);
    }

    // Download a file by path
    @GetMapping("/users/{userId}/safeboxes/{safeBoxName}/files")
    public ResponseEntity<byte[]> download(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("path") String relativePath) throws IOException {
        Path base = storageService.ensureSafeBox(userId, safeBoxName);
        Path file = base.resolve(relativePath).normalize();
        if (!Files.exists(file) || Files.isDirectory(file)) return ResponseEntity.notFound().build();
        String mime = Files.probeContentType(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(mime != null ? mime : MediaType.APPLICATION_OCTET_STREAM_VALUE))
                .body(Files.readAllBytes(file));
    }

    // Download a folder (or entire safebox) as ZIP. If path is empty or missing, zips the safebox root.
    @GetMapping("/users/{userId}/safeboxes/{safeBoxName}/download/zip")
    public ResponseEntity<byte[]> downloadZip(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam(value = "path", required = false) String relativePath
    ) throws IOException {
        Path base = storageService.ensureSafeBox(userId, safeBoxName);
        Path target = (relativePath == null || relativePath.isBlank()) ? base : base.resolve(relativePath).normalize();
        if (!target.startsWith(base) || !Files.exists(target)) return ResponseEntity.notFound().build();

        String zipName = target.equals(base) ? safeBoxName + ".zip" : target.getFileName().toString() + ".zip";
        byte[] zipBytes = zipPathToBytes(base, target);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + zipName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zipBytes);
    }

    // Download a ZIP containing a set of files by their relative paths
    @PostMapping("/users/{userId}/safeboxes/{safeBoxName}/download/zip")
    public ResponseEntity<byte[]> downloadZipOfFiles(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestBody PathsRequest body
    ) throws IOException {
        if (body == null || body.paths == null || body.paths.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Path base = storageService.ensureSafeBox(userId, safeBoxName);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (java.util.zip.ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (String rel : body.paths) {
                Path file = base.resolve(rel).normalize();
                if (!file.startsWith(base) || !Files.exists(file) || Files.isDirectory(file)) {
                    continue; // skip invalid entries
                }
                String entryName = rel.replace('\\', '/');
                zos.putNextEntry(new ZipEntry(entryName));
                Files.copy(file, zos);
                zos.closeEntry();
            }
        }
        byte[] zip = baos.toByteArray();
        String zipName = safeBoxName + "-files.zip";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + zipName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }

    private byte[] zipPathToBytes(Path base, Path target) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (java.util.zip.ZipOutputStream zos = new ZipOutputStream(baos)) {
            if (Files.isRegularFile(target)) {
                String entryName = base.relativize(target).toString().replace('\\', '/');
                zos.putNextEntry(new ZipEntry(entryName));
                Files.copy(target, zos);
                zos.closeEntry();
            } else {
                Files.walk(target).forEach(p -> {
                    try {
                        if (Files.isDirectory(p)) return;
                        String entryName = base.relativize(p).toString().replace('\\', '/');
                        zos.putNextEntry(new ZipEntry(entryName));
                        Files.copy(p, zos);
                        zos.closeEntry();
                    } catch (IOException ignored) { }
                });
            }
        }
        return baos.toByteArray();
    }

    public static class PathsRequest {
        public List<String> paths;
    }

    // Per-safebox retention settings
    @GetMapping("/users/{userId}/safeboxes/{safeBoxName}/settings/retention-days")
    public ResponseEntity<Integer> getRetentionDays(
            @PathVariable String userId,
            @PathVariable String safeBoxName) throws IOException {
        return ResponseEntity.ok(storageService.getRetentionDays(userId, safeBoxName));
    }

    @PutMapping("/users/{userId}/safeboxes/{safeBoxName}/settings/retention-days")
    public ResponseEntity<Integer> setRetentionDays(
            @PathVariable String userId,
            @PathVariable String safeBoxName,
            @RequestParam("days") int days) throws IOException {
        storageService.setRetentionDays(userId, safeBoxName, days);
        return ResponseEntity.ok(storageService.getRetentionDays(userId, safeBoxName));
    }
}
