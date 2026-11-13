package com.example.zabbixportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ZabbixPortalApplication {

    public static void main(String[] args) {
        // Drop idle connections to Zabbix before Apache does (its KeepAliveTimeout defaults to 5s),
        // so a request is never sent on a connection the server has just closed.
        if (System.getProperty("jdk.httpclient.keepalive.timeout") == null) {
            System.setProperty("jdk.httpclient.keepalive.timeout", "3");
        }
        SpringApplication.run(ZabbixPortalApplication.class, args);
    }
}
