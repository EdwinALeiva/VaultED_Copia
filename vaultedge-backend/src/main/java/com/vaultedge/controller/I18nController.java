package com.vaultedge.controller;

import com.vaultedge.service.I18nService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/i18n")
public class I18nController {
    private final I18nService i18nService;

    public I18nController(I18nService i18nService) {
        this.i18nService = i18nService;
    }

    @GetMapping("/catalog")
    public ResponseEntity<Map<String, Object>> catalog(@RequestParam(name = "lang", required = false) String langParam,
                                                       @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage) {
        Locale locale = resolveLocale(langParam, acceptLanguage);
        Map<String, String> catalog = i18nService.getCatalog(locale);
        Map<String, Object> body = new HashMap<>();
        body.put("locale", locale.toLanguageTag());
        body.put("messages", catalog);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/languages")
    public ResponseEntity<List<Map<String,String>>> languages() {
        // Enabled languages (extend as translations become complete)
        List<Map<String,String>> list = List.of(
                Map.of("code","en","name","English"),
                Map.of("code","es","name","Español"),
                Map.of("code","fr","name","Français")
        );
        return ResponseEntity.ok(list);
    }

    private Locale resolveLocale(String langParam, String acceptLanguage) {
        if (langParam != null && !langParam.isBlank()) {
            return Locale.forLanguageTag(langParam);
        }
        if (acceptLanguage != null && !acceptLanguage.isBlank()) {
            String first = acceptLanguage.split(",")[0];
            return Locale.forLanguageTag(first);
        }
        return Locale.ENGLISH;
    }
}
