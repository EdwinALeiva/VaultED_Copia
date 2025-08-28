package com.vaultedge.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "languages")
@Data
public class Language {
    @Id
    @Column(length = 8)
    private String code; // ISO code

    @Column(nullable = false, length = 64)
    private String name; // Display name

    @Column(nullable = false)
    private boolean enabled = true;
}
