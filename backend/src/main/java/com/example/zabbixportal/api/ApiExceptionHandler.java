package com.example.zabbixportal.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import com.example.zabbixportal.security.LoginRateLimiter;
import com.example.zabbixportal.security.PortalAccess;
import com.example.zabbixportal.zabbix.ZabbixApiException;
import com.example.zabbixportal.zabbix.ZabbixUnavailableException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Turns errors into RFC 7807 problem responses; the frontend shows the "detail" text.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    private final SessionSupport sessions;

    public ApiExceptionHandler(SessionSupport sessions) {
        this.sessions = sessions;
    }

    @ExceptionHandler(SessionSupport.NotLoggedInException.class)
    ProblemDetail notLoggedIn(SessionSupport.NotLoggedInException e) {
        return problem(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(LoginRateLimiter.TooManyLoginAttemptsException.class)
    ProblemDetail tooManyAttempts(LoginRateLimiter.TooManyLoginAttemptsException e) {
        return problem(HttpStatus.TOO_MANY_REQUESTS, e.getMessage());
    }

    @ExceptionHandler(PortalAccess.AccessDeniedException.class)
    ProblemDetail accessDenied(PortalAccess.AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail unreadable(HttpMessageNotReadableException e) {
        return problem(HttpStatus.BAD_REQUEST, "Malformed request body");
    }

    /** Anything unexpected: log it, but never send internal details to the browser. */
    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception e) {
        if (e instanceof ErrorResponse standard) {
            // Spring's own errors (404 for a missing file, 405, missing parameter, ...) keep their status.
            return standard.getBody();
        }
        log.error("Unexpected error", e);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error. Check the portal logs.");
    }

    @ExceptionHandler(ZabbixApiException.class)
    ProblemDetail zabbixError(ZabbixApiException e, HttpServletRequest request) {
        if (e.isLoginFailure()) {
            return problem(HttpStatus.UNAUTHORIZED, e.getMessage());
        }
        if (e.isPermissionDenied()) {
            // The session is fine; this account's Zabbix role does not allow this call.
            log.warn("Zabbix refused the call for this account: {}", e.getMessage());
            return problem(HttpStatus.FORBIDDEN, e.getMessage());
        }
        if (e.isSessionExpired()) {
            sessions.clear(request);
            return problem(HttpStatus.UNAUTHORIZED, "Your Zabbix session has expired. Please log in again.");
        }
        log.warn("Zabbix API error: {}", e.getMessage());
        return problem(HttpStatus.BAD_GATEWAY, e.getMessage());
    }

    @ExceptionHandler(ZabbixUnavailableException.class)
    ProblemDetail unavailable(ZabbixUnavailableException e) {
        log.error(e.getMessage());
        // Details (URL, network error) stay in the server log.
        return problem(HttpStatus.BAD_GATEWAY, "Zabbix is not reachable right now. Please try again later.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HandlerMethodValidationException.class})
    ProblemDetail invalid(Exception e) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request: please check the values you entered");
    }

    private static ProblemDetail problem(HttpStatus status, String detail) {
        return ProblemDetail.forStatusAndDetail(status, detail);
    }
}
