package com.hexaware.portfolio.portfolio_backend.exceptions;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

class GlobalExceptionHandlerTest {

    @Test
    void preservesResponseStatusExceptionStatusAndReason() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");
        ResponseStatusException exception = new ResponseStatusException(
                HttpStatus.CONFLICT, "Email is already registered");

        var response = handler.handleResponseStatus(exception, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("Email is already registered", response.getBody().message());
        assertEquals("/api/auth/register", response.getBody().path());
    }
}
