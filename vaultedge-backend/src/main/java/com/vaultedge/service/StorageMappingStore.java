package com.vaultedge.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class StorageMappingStore {

    private final Path storageRoot;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Path mappingsFile;
    private StorageMappings mappings;

    public StorageMappingStore(Path storageRoot) throws IOException {
        this.storageRoot = storageRoot;
        this.mappingsFile = storageRoot.resolve(".vaultedge_mappings.json");
        load();
    }

    private synchronized void load() throws IOException {
        if (Files.exists(mappingsFile)) {
            byte[] bytes = Files.readAllBytes(mappingsFile);
            mappings = mapper.readValue(bytes, StorageMappings.class);
            if (mappings == null) mappings = new StorageMappings();
        } else {
            mappings = new StorageMappings();
        }
    }

    public synchronized StorageMappings.UserMapping getUserMapping(String userId) {
        return mappings.users.get(userId);
    }

    public synchronized void setUserMapping(String userId, StorageMappings.UserMapping m) {
        mappings.users.put(userId, m);
    }

    public synchronized void save() throws IOException {
        byte[] bytes = mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(mappings);
        Files.write(mappingsFile, bytes);
    }
}
