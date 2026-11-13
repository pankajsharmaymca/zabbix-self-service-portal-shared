package com.example.zabbixportal.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "zabbix")
/**
 * @param url         Zabbix API URL, or the Zabbix frontend base URL (api_jsonrpc.php is appended)
 * @param insecureSsl skip TLS certificate checks (testing only)
 * @param caFile      PEM file with the CA certificate(s) that signed the Zabbix HTTPS certificate (optional)
 */
public record ZabbixProperties(String url, boolean insecureSsl, Duration timeout, int resultLimit, String caFile) {

    public ZabbixProperties {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("zabbix.url must be configured");
        }
        url = url.strip();
        if (!url.endsWith("api_jsonrpc.php")) {
            url = url.endsWith("/") ? url + "api_jsonrpc.php" : url + "/api_jsonrpc.php";
        }
        if (timeout == null) {
            timeout = Duration.ofSeconds(30);
        }
        if (resultLimit <= 0) {
            resultLimit = 2000;
        }
        caFile = caFile == null || caFile.isBlank() ? null : caFile.strip();
    }
}
