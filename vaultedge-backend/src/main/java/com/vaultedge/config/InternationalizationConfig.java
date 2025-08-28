package com.vaultedge.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@Configuration
public class InternationalizationConfig {

    public static final List<Locale> SUPPORTED_LOCALES = List.of(
        Locale.ENGLISH,
        Locale.forLanguageTag("es"),
        Locale.forLanguageTag("fr"),
        Locale.forLanguageTag("de"),
        Locale.forLanguageTag("pt")
    );

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.ENGLISH);
        resolver.setSupportedLocales(SUPPORTED_LOCALES);
        return resolver;
    }

    @Bean
    public MessageSource messageSource() {
        ReloadableResourceBundleMessageSource ms = new ReloadableResourceBundleMessageSource();
        ms.setBasename("classpath:i18n/messages");
        ms.setDefaultEncoding(StandardCharsets.UTF_8.name());
        ms.setFallbackToSystemLocale(false);
        ms.setUseCodeAsDefaultMessage(true);
        ms.setCacheSeconds(60);
        return ms;
    }
}
