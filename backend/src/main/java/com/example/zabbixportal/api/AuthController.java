package com.example.zabbixportal.api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.zabbixportal.api.dto.Dtos.LoginRequest;
import com.example.zabbixportal.api.dto.Dtos.ServerInfo;
import com.example.zabbixportal.api.dto.Dtos.SessionInfo;
import com.example.zabbixportal.api.dto.Dtos.SeverityDto;
import com.example.zabbixportal.service.ZabbixService;
import com.example.zabbixportal.security.LoginRateLimiter;
import com.example.zabbixportal.security.PortalAccess;
import com.example.zabbixportal.zabbix.ZabbixApiException;
import com.example.zabbixportal.zabbix.ZabbixClient;
import com.example.zabbixportal.zabbix.ZabbixSession;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final ZabbixClient zabbix;
    private final SessionSupport sessions;
    private final LoginRateLimiter rateLimiter;
    private final PortalAccess access;
    private final ZabbixService service;

    public AuthController(ZabbixClient zabbix, SessionSupport sessions, LoginRateLimiter rateLimiter,
                          PortalAccess access, ZabbixService service) {
        this.zabbix = zabbix;
        this.sessions = sessions;
        this.rateLimiter = rateLimiter;
        this.access = access;
        this.service = service;
    }

    /** Unauthenticated: only whether Zabbix is reachable. No URL or version is disclosed. */
    @GetMapping("/info")
    public ServerInfo info() {
        try {
            zabbix.apiVersion();
            return new ServerInfo(true);
        } catch (RuntimeException e) {
            return new ServerInfo(false);
        }
    }

    /** Zabbix user.login */
    @PostMapping("/auth/login")
    public SessionInfo login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        // Behind Apache this is the real client address (server.forward-headers-strategy=native).
        String client = request.getRemoteAddr();
        rateLimiter.check(client);
        ZabbixSession session;
        try {
            session = zabbix.login(body.username(), body.password());
        } catch (ZabbixApiException e) {
            rateLimiter.recordFailure(client);
            throw e;
        }
        try {
            access.verify(session);
        } catch (PortalAccess.AccessDeniedException e) {
            rateLimiter.recordFailure(client);
            throw e;
        }
        rateLimiter.reset(client);
        sessions.store(request, session);
        return toInfo(session);
    }

    /** Zabbix user.logout */
    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        ZabbixSession session = sessions.current(request);
        if (session != null) {
            zabbix.logout(session);
        }
        sessions.clear(request);
        return ResponseEntity.noContent().build();
    }

    /** Trigger severity names and colours as configured in Zabbix (settings.get). */
    @GetMapping("/severities")
    public List<SeverityDto> severities(HttpServletRequest request) {
        return service.severities(sessions.require(request));
    }

    @GetMapping("/auth/me")
    public SessionInfo me(HttpServletRequest request) {
        return toInfo(sessions.require(request));
    }

    private SessionInfo toInfo(ZabbixSession session) {
        return new SessionInfo(session.username());
    }
}
