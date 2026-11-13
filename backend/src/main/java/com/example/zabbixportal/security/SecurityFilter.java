package com.example.zabbixportal.security;

import java.io.IOException;
import java.util.Set;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Adds browser security headers to every response and rejects state-changing API
 * requests that do not carry the portal's anti-CSRF header.
 *
 * Browsers cannot add a custom header to a cross-site request without a CORS
 * preflight, which this backend refuses for unknown origins. Together with the
 * SameSite=Strict session cookie this blocks cross-site request forgery.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class SecurityFilter extends OncePerRequestFilter {

    public static final String CSRF_HEADER = "X-Requested-With";
    public static final String CSRF_VALUE = "zabbix-portal";

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    // MUI (Emotion) injects <style> elements at runtime, hence 'unsafe-inline' for styles only.
    private static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        response.setHeader("Content-Security-Policy", CSP);
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        if (request.isSecure()) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000");
        }

        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store");
            if (!SAFE_METHODS.contains(request.getMethod())
                    && !CSRF_VALUE.equals(request.getHeader(CSRF_HEADER))) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/problem+json");
                response.getWriter().write(
                        "{\"status\":403,\"title\":\"Forbidden\",\"detail\":\"Request rejected: missing anti-CSRF header\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
