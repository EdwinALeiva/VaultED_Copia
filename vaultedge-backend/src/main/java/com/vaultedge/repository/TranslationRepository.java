package com.vaultedge.repository;

import com.vaultedge.model.Translation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TranslationRepository extends JpaRepository<Translation, Long> {
    List<Translation> findByLanguageCode(String languageCode);
}
