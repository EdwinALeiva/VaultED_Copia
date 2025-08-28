package com.vaultedge.controller.storage;

import com.vaultedge.service.StorageMigrationService;
import com.vaultedge.service.StorageMappings;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/storage/users")
public class MigrationController {

    // lightweight per-call service construction - fine for admin-triggered migration
    @PostMapping("/{userId}/migrate")
    public ResponseEntity<String> migrateUser(@PathVariable String userId) {
        try {
            StorageMigrationService svc = new StorageMigrationService(Paths.get(System.getProperty("user.dir")).resolve("storage"));
            svc.migrateUser(userId);
            return ResponseEntity.ok("Migration completed for user " + userId);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("Migration failed: " + e.getMessage());
        }
    }

    @GetMapping("/{userId}/mapping")
    public ResponseEntity<StorageMappings.UserMapping> getMapping(@PathVariable String userId) {
        try {
            StorageMigrationService svc = new StorageMigrationService(Paths.get(System.getProperty("user.dir")).resolve("storage"));
            StorageMappings.UserMapping m = svc.getMapping(userId);
            if (m == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(m);
        } catch (IOException e) {
            return ResponseEntity.status(500).build();
        }
    }
}
