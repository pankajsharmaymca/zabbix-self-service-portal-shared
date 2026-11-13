package com.example.zabbixportal.zabbix;

/**
 * An error returned by the Zabbix JSON-RPC API.
 */
public class ZabbixApiException extends RuntimeException {

    private final int code;
    private final String data;

    public ZabbixApiException(int code, String message, String data) {
        super(data == null || data.isBlank() ? message : message + " " + data);
        this.code = code;
        this.data = data;
    }

    public int getCode() {
        return code;
    }

    public String getData() {
        return data;
    }

    /**
     * The account is signed in, but its Zabbix role or permissions do not allow this call.
     * Zabbix words it as "Not authorised." too, so this is checked before a session check.
     */
    public boolean isPermissionDenied() {
        String text = (getMessage() == null ? "" : getMessage()).toLowerCase();
        return text.contains("no permissions") || text.contains("permission denied")
                || text.contains("not allowed to call") || text.contains("no access to");
    }

    /** Zabbix reports an expired or invalid session this way (wording differs between versions). */
    public boolean isSessionExpired() {
        if (isPermissionDenied()) {
            return false;
        }
        String text = (getMessage() == null ? "" : getMessage()).toLowerCase();
        return text.contains("re-login") || text.contains("not authorised") || text.contains("not authorized")
                || text.contains("session terminated");
    }

    public boolean isLoginFailure() {
        String text = (getMessage() == null ? "" : getMessage()).toLowerCase();
        return text.contains("incorrect user name or password") || text.contains("login name or password is incorrect")
                || text.contains("account is temporarily blocked");
    }
}
