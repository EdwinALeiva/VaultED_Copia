package com.vaultedge.controller;

import com.vaultedge.model.User;
import com.vaultedge.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.MessageSource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api")
public class AuthController {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired
    private MessageSource messageSource;

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody User loginRequest, java.util.Locale locale) {
        if (loginRequest == null || loginRequest.getUsername() == null || loginRequest.getPassword() == null) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("login.error.invalidCredentials", null, locale));
        }
        Optional<User> userOptional = userRepository.findByUsername(loginRequest.getUsername());
        // Generic response to avoid user enumeration
        String genericFailure = messageSource.getMessage("login.error.invalidCredentials", null, locale);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(401).body(genericFailure);
        }
        User user = userOptional.get();
        String raw = loginRequest.getPassword();
        String stored = user.getPassword();
        boolean ok = false;
        if (stored != null && stored.startsWith("$2")) { // bcrypt hash present
            ok = passwordEncoder.matches(raw, stored);
        } else {
            // Fallback for demo users not yet migrated (plain text). Consider removing once all are hashed.
            ok = stored != null && stored.equals(raw);
        }
        if (!ok) return ResponseEntity.status(401).body(genericFailure);
    return ResponseEntity.ok(messageSource.getMessage("login.success", null, locale));
    }
}
