package com.example.zabbixportal.zabbix;

import java.io.Serializable;

/**
 * A logged-in Zabbix session. Stored server-side in the HTTP session only;
 * the token never reaches the browser.
 */
public record ZabbixSession(String token, String username, ZabbixVersion version) implements Serializable {
}
