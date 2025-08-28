package com.vaultedge.tools;

import com.vaultedge.service.StorageMigrationService;

import java.nio.file.Paths;

public class MainMigration {
    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.out.println("Usage: java -cp <jar> com.vaultedge.tools.MainMigration <userId>");
            return;
        }
        String userId = args[0];
        StorageMigrationService svc = new StorageMigrationService(Paths.get(System.getProperty("user.dir")).resolve("storage"));
        svc.migrateUser(userId);
        System.out.println("Migration completed for user: " + userId);
    }
}
