package com.hexaware.portfolio.security.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.hexaware.portfolio.security.controller.SecurityMasterController;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class SecurityMasterCacheWarmer implements ApplicationRunner {

    private final SecurityMasterController securityMasterController;

    @Override
    public void run(ApplicationArguments args) {
        securityMasterController.list(0, 50);
    }
}
