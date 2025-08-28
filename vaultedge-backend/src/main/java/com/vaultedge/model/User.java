package com.vaultedge.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.UUID;

@Entity
@Table(name = "users", uniqueConstraints = {@UniqueConstraint(columnNames = "username")}) // Added unique constraint for username
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, unique = true) // Ensures username is unique
    @NotBlank
    @Size(min = 3, max = 100)
    private String username;

    @Email
    private String email;

    // Accept password in incoming JSON but never serialize it back out
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    private String firstName;
    private String lastName;
    private String role;
}
