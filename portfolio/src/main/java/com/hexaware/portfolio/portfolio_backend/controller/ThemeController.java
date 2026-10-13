package com.hexaware.portfolio.portfolio_backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hexaware.portfolio.portfolio_backend.dto.AttachThemeRequest;
import com.hexaware.portfolio.portfolio_backend.dto.ThemeDefinitionResponse;
import com.hexaware.portfolio.portfolio_backend.dto.UpdateThemeDefinitionRequest;
import com.hexaware.portfolio.portfolio_backend.entity.Portfolio;
import com.hexaware.portfolio.portfolio_backend.entity.enums.InvestmentThemes;
import com.hexaware.portfolio.portfolio_backend.service.ThemeService;

import lombok.AllArgsConstructor;

@RestController
@RequestMapping("/api")
@AllArgsConstructor
public class ThemeController {

    private final ThemeService themeService;

    @GetMapping("/themes")
    public ResponseEntity<List<ThemeDefinitionResponse>> getThemes() {
        return ResponseEntity.ok(themeService.getAllThemes());
    }

    @PutMapping("/themes/{theme}/definition")
    public ResponseEntity<ThemeDefinitionResponse> updateThemeDefinition(
            @PathVariable InvestmentThemes theme,
            @RequestBody UpdateThemeDefinitionRequest request) {
        return ResponseEntity.ok(themeService.updateDefinition(theme, request));
    }

    @DeleteMapping("/themes/{theme}")
    public ResponseEntity<Void> deleteThemeDefinition(@PathVariable InvestmentThemes theme) {
        themeService.deleteTheme(theme);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/portfolios/{portfolioId}/theme")
    public ResponseEntity<Portfolio> attachTheme(
            @PathVariable Long portfolioId,
            @RequestBody AttachThemeRequest request) {
        return ResponseEntity.ok(themeService.attachTheme(
                portfolioId,
                request == null ? null : request.theme()));
    }

    @GetMapping("/portfolios/{portfolioId}/theme")
    public ResponseEntity<ThemeDefinitionResponse> getAttachedTheme(@PathVariable Long portfolioId) {
        return ResponseEntity.ok(themeService.getAttachedTheme(portfolioId));
    }

    @DeleteMapping("/portfolios/{portfolioId}/theme")
    public ResponseEntity<Void> removeTheme(@PathVariable Long portfolioId) {
        themeService.removeTheme(portfolioId);
        return ResponseEntity.noContent().build();
    }
}