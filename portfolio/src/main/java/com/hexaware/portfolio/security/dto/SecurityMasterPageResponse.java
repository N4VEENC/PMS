package com.hexaware.portfolio.security.dto;

import java.util.List;

public record SecurityMasterPageResponse(
        List<SecurityMasterResponse> content,
        long totalElements,
        int totalPages,
        int currentPage,
        int pageSize) {
}
