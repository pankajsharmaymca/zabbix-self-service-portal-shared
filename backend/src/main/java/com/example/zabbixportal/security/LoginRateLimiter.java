package com.example.zabbixportal.security;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limits failed logins per client IP address (in memory). Zabbix additionally blocks
 * an account after repeated failures; this stops one address from trying many accounts.
 */
@Component
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);
    private static final int MAX_TRACKED_ADDRESSES = 10_000;

    private final int maxFailures;
    private final Duration window;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public LoginRateLimiter(@Value("${portal.login.max-failures:10}") int maxFailures,
                            @Value("${portal.login.window:15m}") Duration window) {
        this.maxFailures = maxFailures;
        this.window = window;
    }

    /** Throws if the address has too many recent failures. */
    public void check(String address) {
        Deque<Instant> attempts = failures.get(address);
        if (attempts == null) {
            return;
        }
        synchronized (attempts) {
            prune(attempts);
            if (attempts.size() >= maxFailures) {
                Duration wait = Duration.between(Instant.now(), attempts.peekFirst().plus(window));
                long minutes = Math.max(1, (wait.toSeconds() + 59) / 60);
                throw new TooManyLoginAttemptsException(
                        "Too many failed sign-in attempts. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
            }
        }
    }

    public void recordFailure(String address) {
        if (failures.size() > MAX_TRACKED_ADDRESSES) {
            failures.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    prune(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
        }
        Deque<Instant> attempts = failures.computeIfAbsent(address, k -> new ArrayDeque<>());
        synchronized (attempts) {
            prune(attempts);
            attempts.addLast(Instant.now());
            if (attempts.size() == maxFailures) {
                log.warn("Sign-in from {} blocked for {} after {} failed attempts", address, window, maxFailures);
            }
        }
    }

    public void reset(String address) {
        failures.remove(address);
    }

    private void prune(Deque<Instant> attempts) {
        Instant cutoff = Instant.now().minus(window);
        while (!attempts.isEmpty() && attempts.peekFirst().isBefore(cutoff)) {
            attempts.removeFirst();
        }
    }

    public static class TooManyLoginAttemptsException extends RuntimeException {
        public TooManyLoginAttemptsException(String message) {
            super(message);
        }
    }
}
