package com.example.zabbixportal.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Look of the portal, set per installation (no rebuild needed):
 * PORTAL_TITLE, PORTAL_LOGO_FILE, PORTAL_PRIMARY_COLOR, PORTAL_ACCENT_COLOR.
 */
@ConfigurationProperties(prefix = "portal.branding")
public record BrandingProperties(String title, String logoFile, String primaryColor, String accentColor) {

    private static final String HEX = "#[0-9A-Fa-f]{6}";

    public BrandingProperties {
        title = title == null || title.isBlank() ? "Zabbix Self-Service Portal" : title.strip();
        logoFile = logoFile == null || logoFile.isBlank() ? null : logoFile.strip();
        primaryColor = primaryColor != null && primaryColor.strip().matches(HEX) ? primaryColor.strip() : null;
        accentColor = accentColor != null && accentColor.strip().matches(HEX) ? accentColor.strip() : null;
    }
}
