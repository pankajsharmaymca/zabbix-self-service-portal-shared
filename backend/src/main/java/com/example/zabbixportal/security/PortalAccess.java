package com.example.zabbixportal.security;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.example.zabbixportal.zabbix.ZabbixClient;
import com.example.zabbixportal.zabbix.ZabbixSession;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Optionally restricts the portal to members of specific Zabbix user groups
 * (portal.allowed-user-groups). Empty = every Zabbix user with API access may sign in.
 */
@Component
public class PortalAccess {

    private static final Logger log = LoggerFactory.getLogger(PortalAccess.class);

    private final ZabbixClient zabbix;
    private final Set<String> allowedGroups;

    public PortalAccess(ZabbixClient zabbix, @Value("${portal.allowed-user-groups:}") String[] allowedGroups) {
        this.zabbix = zabbix;
        this.allowedGroups = Arrays.stream(allowedGroups)
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toUnmodifiableSet());
        if (!this.allowedGroups.isEmpty()) {
            log.info("Portal restricted to Zabbix user groups {}", this.allowedGroups);
        }
    }

    /** Throws (after logging the Zabbix session out) if the user is not in an allowed group. */
    public void verify(ZabbixSession session) {
        if (allowedGroups.isEmpty()) {
            return;
        }
        String usernameField = session.version().usesUsernameParam() ? "username" : "alias";
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("output", List.of("userid"));
        params.put("selectUsrgrps", List.of("name"));
        params.put("filter", Map.of(usernameField, session.username()));

        Set<String> groups = new HashSet<>();
        try {
            for (JsonNode user : zabbix.call(session, "user.get", params)) {
                user.path("usrgrps").forEach(g -> groups.add(g.path("name").asText().toLowerCase()));
            }
        } catch (RuntimeException e) {
            zabbix.logout(session);
            throw e;
        }

        if (groups.stream().noneMatch(allowedGroups::contains)) {
            zabbix.logout(session);
            log.warn("Sign-in refused for '{}': not in an allowed user group", session.username());
            throw new AccessDeniedException("Your Zabbix account is not allowed to use this portal. "
                    + "Ask your Zabbix administrator to add you to the portal's user group.");
        }
    }

    public static class AccessDeniedException extends RuntimeException {
        public AccessDeniedException(String message) {
            super(message);
        }
    }
}
