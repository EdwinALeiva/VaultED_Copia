package com.vaultedge.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

@Entity
@Table(name = "translations", indexes = {
        @Index(name = "idx_translation_lang_key", columnList = "languageCode, translationKey")
})
@Data
public class Translation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String languageCode; // e.g., en, es

    @Column(length = 64)
    private String namespace; // optional grouping

    @Column(nullable = false, length = 160)
    private String translationKey; // e.g., login.title

    @Column(nullable = false, length = 1000)
    private String value; // translated text

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
