package com.example.zabbixportal.zabbix;

/**
 * The Zabbix server could not be reached or did not return a JSON-RPC response.
 */
public class ZabbixUnavailableException extends RuntimeException {

    public ZabbixUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
