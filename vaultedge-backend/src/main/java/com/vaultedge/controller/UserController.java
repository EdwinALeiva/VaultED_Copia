package com.vaultedge.controller;

import com.vaultedge.model.User;
import com.vaultedge.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.MessageSource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MessageSource messageSource;

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody User incoming, java.util.Locale locale) {
        if (incoming.getUsername() == null || incoming.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("user.username.required", null, locale));
        }
        if (incoming.getUsername().length() < 3) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("user.username.tooShort", null, locale));
        }
        if (incoming.getPassword() == null || incoming.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("password.required", null, locale));
        }
        String rawPw = incoming.getPassword();
        if (rawPw.length() < 8) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("password.tooShort", null, locale));
        }
        boolean hasLetter = rawPw.chars().anyMatch(Character::isLetter);
        boolean hasDigit = rawPw.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            return ResponseEntity.badRequest().body(messageSource.getMessage("password.missingClasses", null, locale));
        }
        if (userRepository.findByUsername(incoming.getUsername()).isPresent()) {
            return ResponseEntity.status(409).body(messageSource.getMessage("user.username.exists", null, locale));
        }
        if (incoming.getEmail() != null && !incoming.getEmail().isBlank() && userRepository.findByEmail(incoming.getEmail()).isPresent()) {
            return ResponseEntity.status(409).body(messageSource.getMessage("user.email.exists", null, locale));
        }
        incoming.setPassword(passwordEncoder.encode(incoming.getPassword()));
        if (incoming.getRole() == null || incoming.getRole().isBlank()) incoming.setRole("user");
        User saved = userRepository.save(incoming);
        Map<String,Object> body = new HashMap<>();
        body.put("id", saved.getId());
        body.put("username", saved.getUsername());
        body.put("email", saved.getEmail());
        body.put("firstName", saved.getFirstName());
        body.put("lastName", saved.getLastName());
        body.put("role", saved.getRole());
        return ResponseEntity.created(URI.create("/api/users/"+saved.getId())).body(body);
    }
}
