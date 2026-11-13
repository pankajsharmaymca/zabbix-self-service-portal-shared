package com.example.zabbixportal.zabbix;

import java.io.Serializable;

/**
 * Zabbix API version, used to pick the request format that version understands.
 */
public record ZabbixVersion(String raw, int major, int minor) implements Serializable {

    public static ZabbixVersion parse(String raw) {
        String[] parts = raw.split("\\.");
        int major = Integer.parseInt(parts[0]);
        int minor = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
        return new ZabbixVersion(raw, major, minor);
    }

    public boolean isAtLeast(int otherMajor, int otherMinor) {
        return major > otherMajor || (major == otherMajor && minor >= otherMinor);
    }

    /** 5.4+: user.login takes "username" instead of "user". */
    public boolean usesUsernameParam() {
        return isAtLeast(5, 4);
    }

    /** 6.4+: the session token goes in an "Authorization: Bearer" header (the "auth" field was removed in 7.2). */
    public boolean usesBearerHeader() {
        return isAtLeast(6, 4);
    }

    /** 6.2+: host groups and template groups are separate objects. */
    public boolean hasSeparateTemplateGroups() {
        return isAtLeast(6, 2);
    }

    /** 5.4+: templates can carry tags. */
    public boolean supportsTemplateTags() {
        return isAtLeast(5, 4);
    }
}
