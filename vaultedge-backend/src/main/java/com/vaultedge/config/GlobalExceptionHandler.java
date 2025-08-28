package com.vaultedge.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final MessageSource messageSource;
    public GlobalExceptionHandler(MessageSource messageSource) { this.messageSource = messageSource; }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<String> handleValidation(MethodArgumentNotValidException ex, java.util.Locale locale) {
        return ResponseEntity.badRequest().body(messageSource.getMessage("error.validationFailed", null, locale));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<String> handleConstraintViolation(ConstraintViolationException ex, java.util.Locale locale) {
        return ResponseEntity.badRequest().body(messageSource.getMessage("error.invalidParameters", null, locale));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException(Exception ex, java.util.Locale locale) {
        // Log full details server-side and return generic message to client
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                             .body(messageSource.getMessage("error.unexpected", null, locale));
    }
}
