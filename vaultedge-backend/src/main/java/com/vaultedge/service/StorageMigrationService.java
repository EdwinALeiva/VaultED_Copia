package com.vaultedge.service;

import java.io.IOException;
import java.nio.file.*;
import java.util.Base64;
import java.util.Map;
import java.util.stream.Collectors;

public class StorageMigrationService {

    private final Path root;
    private final StorageMappingStore mappingStore;

    public StorageMigrationService(Path root) throws IOException {
        this.root = root;
        this.mappingStore = new StorageMappingStore(root);
    }

    // deterministic masked id: base64url(userId) truncated
    private String mask(String input) {
        String b = Base64.getUrlEncoder().withoutPadding().encodeToString(input.getBytes());
        return b.length() > 12 ? b.substring(0, 12) : b;
    }

    public synchronized void migrateUser(String userId) throws IOException {
        Path userPath = root.resolve(userId);
        if (!Files.exists(userPath) || !Files.isDirectory(userPath)) return;
        StorageMappings.UserMapping um = mappingStore.getUserMapping(userId);
        if (um == null) um = new StorageMappings.UserMapping();
        if (um.maskedUserId == null || um.maskedUserId.isBlank()) um.maskedUserId = mask(userId);
        // ensure masked root
        Path maskedUserRoot = root.resolve(um.maskedUserId);
        Files.createDirectories(maskedUserRoot);
        Path rootVault = maskedUserRoot.resolve("RootVault");
        Files.createDirectories(rootVault);

        // for each safebox folder in userPath, move into maskedUserRoot/RootVault/maskedSafeboxName
        try (var stream = Files.list(userPath)) {
            for (Path p : stream.collect(Collectors.toList())) {
                if (!Files.isDirectory(p)) continue;
                String sbName = p.getFileName().toString();
                // skip marker files
                if (sbName.startsWith(".") || sbName.endsWith(".log") || sbName.endsWith(".retention")) continue;
                String masked = um.safeboxes.get(sbName);
                if (masked == null) {
                    masked = mask(userId + ":" + sbName);
                    um.safeboxes.put(sbName, masked);
                }
                Path dest = rootVault.resolve(masked);
                // if dest exists, merge by moving contents
                if (!Files.exists(dest)) {
                    Files.move(p, dest, StandardCopyOption.ATOMIC_MOVE);
                } else {
                    // merge contents
                    try (var walk = Files.walk(p)) {
                        for (Path src : walk.collect(Collectors.toList())) {
                            Path relative = p.relativize(src);
                            Path target = dest.resolve(relative.toString());
                            if (Files.isDirectory(src)) {
                                Files.createDirectories(target);
                            } else if (Files.isRegularFile(src)) {
                                Files.createDirectories(target.getParent());
                                Files.move(src, target, StandardCopyOption.REPLACE_EXISTING);
                            }
                        }
                    }
                    // delete empty original folder
                    try { Files.walk(p).sorted(java.util.Comparator.reverseOrder()).forEach(s -> { try { Files.deleteIfExists(s);} catch (IOException ignored) {} }); } catch (Exception ignored) {}
                }
            }
        }
        mappingStore.setUserMapping(userId, um);
        mappingStore.save();
    }

    public StorageMappings.UserMapping getMapping(String userId) {
        return mappingStore.getUserMapping(userId);
    }
}
