package com.example.zabbixportal.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.example.zabbixportal.zabbix.ZabbixClient;

/** Logs at startup whether the configured Zabbix API answers, so a wrong ZABBIX_URL shows up immediately. */
@Component
public class StartupCheck {

    private static final Logger log = LoggerFactory.getLogger(StartupCheck.class);

    private final ZabbixClient zabbix;
    private final ZabbixProperties props;

    public StartupCheck(ZabbixClient zabbix, ZabbixProperties props) {
        this.zabbix = zabbix;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void check() {
        try {
            log.info("Zabbix API OK: {} (Zabbix {})", props.url(), zabbix.apiVersion().raw());
        } catch (RuntimeException e) {
            log.warn("Zabbix API NOT reachable at {}: {}. Check ZABBIX_URL (and ZABBIX_CA_FILE / ZABBIX_INSECURE_SSL "
                    + "for HTTPS) in /etc/zabbix-portal/portal.env, then: sudo systemctl restart zabbix-portal",
                    props.url(), e.getMessage());
        }
    }
}
