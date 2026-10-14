package com.hexaware.portfolio.portfolio_backend.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {
    private AppUserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private AuthenticationManager authenticationManager;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(AppUserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        authenticationManager = mock(AuthenticationManager.class);
        jwtService = mock(JwtService.class);
        authService = new AuthService(userRepository, passwordEncoder, authenticationManager, jwtService);

        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(userRepository.existsByUsername(any())).thenReturn(false);
        when(passwordEncoder.encode(any())).thenAnswer(invocation -> "encoded-" + invocation.getArgument(0));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> {
            AppUser user = invocation.getArgument(0);
            user.setId(1L);
            return user;
        });
        when(jwtService.generateToken(any())).thenReturn("test-token");
    }

    @Test
    void registersMultipleFundManagersWithUniqueCredentials() {
        AuthResponse first = authService.register(
                new RegisterRequest("first@example.com", "first-manager", "password-one"));
        AuthResponse second = authService.register(
                new RegisterRequest("second@example.com", "second-manager", "password-two"));

        assertEquals("first@example.com", first.email());
        assertEquals("first-manager", first.username());
        assertEquals("second@example.com", second.email());
        assertEquals("second-manager", second.username());
        verify(userRepository, org.mockito.Mockito.times(2)).save(any(AppUser.class));
        verify(userRepository, never()).count();
    }
}
