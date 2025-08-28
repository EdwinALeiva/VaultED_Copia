package com.vaultedge.service;

import java.util.HashMap;
import java.util.Map;

public class StorageMappings {

    public static class UserMapping {
        public String maskedUserId;
        // original safebox name -> masked dir name
        public Map<String, String> safeboxes = new HashMap<>();
    }

    // userId -> mapping
    public Map<String, UserMapping> users = new HashMap<>();

}
