package com.example.zabbixportal.zabbix;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.example.zabbixportal.config.ZabbixProperties;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Thin JSON-RPC 2.0 client for the Zabbix API.
 *
 * Handles the differences between Zabbix versions:
 * <ul>
 *   <li>user.login takes "user" before 5.4 and "username" from 5.4 on;</li>
 *   <li>the session token goes in the "auth" request field before 6.4 and in an
 *       "Authorization: Bearer" header from 6.4 on (the field was removed in 7.2).</li>
 * </ul>
 */
@Component
public class ZabbixClient {

    private static final Logger log = LoggerFactory.getLogger(ZabbixClient.class);

    private final RestClient rest;
    private final ZabbixProperties props;
    private final AtomicLong requestIds = new AtomicLong();

    public ZabbixClient(RestClient zabbixRestClient, ZabbixProperties props) {
        this.rest = zabbixRestClient;
        this.props = props;
    }

    public String serverUrl() {
        return props.url();
    }

    /** apiinfo.version must be called without authentication. */
    public ZabbixVersion apiVersion() {
        JsonNode result = send("apiinfo.version", List.of(), null, null);
        return ZabbixVersion.parse(result.asText());
    }

    public ZabbixSession login(String username, String password) {
        ZabbixVersion version = apiVersion();
        Map<String, Object> params = new LinkedHashMap<>();
        params.put(version.usesUsernameParam() ? "username" : "user", username);
        params.put("password", password);
        JsonNode result = send("user.login", params, null, null);
        log.info("User '{}' logged in to Zabbix {}", username, version.raw());
        return new ZabbixSession(result.asText(), username, version);
    }

    public void logout(ZabbixSession session) {
        try {
            call(session, "user.logout", List.of());
        } catch (RuntimeException e) {
            // The session may already be gone on the Zabbix side; nothing else to do.
            log.debug("user.logout failed: {}", e.getMessage());
        }
    }

    public JsonNode call(ZabbixSession session, String method, Object params) {
        return send(method, params, session.token(), session.version());
    }

    private JsonNode send(String method, Object params, String token, ZabbixVersion version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("jsonrpc", "2.0");
        body.put("method", method);
        body.put("params", params);
        body.put("id", requestIds.incrementAndGet());

        boolean bearer = token != null && version != null && version.usesBearerHeader();
        if (token != null && !bearer) {
            body.put("auth", token);
        }

        JsonNode response;
        try {
            response = rest.post()
                    .headers(h -> {
                        if (bearer) {
                            h.setBearerAuth(token);
                        }
                    })
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new ZabbixUnavailableException(
                    "Could not reach the Zabbix API at " + props.url() + ": " + e.getMessage(), e);
        }

        if (response == null) {
            throw new ZabbixUnavailableException("Empty response from the Zabbix API for " + method, null);
        }
        JsonNode error = response.get("error");
        if (error != null && !error.isNull()) {
            throw new ZabbixApiException(
                    error.path("code").asInt(),
                    error.path("message").asText("Zabbix API error"),
                    error.path("data").asText(null));
        }
        if (!response.has("result")) {
            throw new ZabbixUnavailableException("Unexpected response from the Zabbix API for " + method, null);
        }
        return response.get("result");
    }
}
