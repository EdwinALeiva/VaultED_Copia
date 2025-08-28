package com.vaultedge.service;

import com.vaultedge.model.Translation;
import com.vaultedge.repository.TranslationRepository;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class I18nService {
    private final MessageSource messageSource;
    private final TranslationRepository translationRepository;

    public I18nService(MessageSource messageSource, TranslationRepository translationRepository) {
        this.messageSource = messageSource;
        this.translationRepository = translationRepository;
    }

    public Map<String, String> getCatalog(Locale locale) {
        Map<String, String> catalog = new TreeMap<>();
        try {
            ResourceBundle bundle = ResourceBundle.getBundle("i18n/messages", locale);
            for (String key : bundle.keySet()) {
                catalog.put(key, bundle.getString(key));
            }
        } catch (MissingResourceException ignored) {}
        List<Translation> overrides = translationRepository.findByLanguageCode(locale.getLanguage());
        for (Translation t : overrides) {
            catalog.put(t.getTranslationKey(), t.getValue());
        }
        return catalog;
    }

    public String resolve(String key, Locale locale, Object... args) {
        try {
            return messageSource.getMessage(key, args, locale);
        } catch (Exception ex) {
            return key; // show key if missing
        }
    }
}
