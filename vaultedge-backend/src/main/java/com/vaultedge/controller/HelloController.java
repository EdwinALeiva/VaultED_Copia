
package com.vaultedge.controller;

import org.springframework.context.MessageSource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Locale;

@RestController
public class HelloController {
    private final MessageSource messageSource;
    public HelloController(MessageSource messageSource) { this.messageSource = messageSource; }

    @GetMapping("/api/hello")
    public String sayHello(Locale locale) {
        return messageSource.getMessage("hello.status", null, locale);
    }
}
