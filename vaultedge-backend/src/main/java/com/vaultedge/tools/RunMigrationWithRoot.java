package com.vaultedge.tools;

import com.vaultedge.service.StorageMigrationService;

import java.nio.file.Path;
import java.nio.file.Paths;

public class RunMigrationWithRoot {
    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.out.println("Usage: <userId> [storageRoot]");
            return;
        }
        String userId = args[0];
        Path root = (args.length > 1) ? Paths.get(args[1]) : Paths.get("C:/myCloudSimulation");
        StorageMigrationService svc = new StorageMigrationService(root);
        svc.migrateUser(userId);
        System.out.println("Migration completed for user: " + userId + " under root: " + root.toAbsolutePath());
    }
}
