package com.example.zabbixportal.api;

import org.springframework.stereotype.Component;

import com.example.zabbixportal.zabbix.ZabbixSession;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/**
 * Keeps the Zabbix session token in the server-side HTTP session.
 */
@Component
public class SessionSupport {

    static final String ATTR = "zabbixSession";

    public ZabbixSession require(HttpServletRequest request) {
        HttpSession http = request.getSession(false);
        Object value = http == null ? null : http.getAttribute(ATTR);
        if (value instanceof ZabbixSession session) {
            return session;
        }
        throw new NotLoggedInException();
    }

    public ZabbixSession current(HttpServletRequest request) {
        HttpSession http = request.getSession(false);
        return http != null && http.getAttribute(ATTR) instanceof ZabbixSession s ? s : null;
    }

    /** Starts a fresh HTTP session (prevents session fixation) and stores the Zabbix session in it. */
    public void store(HttpServletRequest request, ZabbixSession session) {
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        request.getSession(true).setAttribute(ATTR, session);
    }

    public void clear(HttpServletRequest request) {
        HttpSession http = request.getSession(false);
        if (http != null) {
            http.invalidate();
        }
    }

    public static class NotLoggedInException extends RuntimeException {
        public NotLoggedInException() {
            super("Not logged in to Zabbix");
        }
    }
}
