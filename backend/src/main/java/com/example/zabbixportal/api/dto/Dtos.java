package com.example.zabbixportal.api.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request and response bodies of the portal REST API.
 */
public final class Dtos {

    private Dtos() {
    }

    /** A Zabbix object reference: id + display name. */
    public record Ref(String id, String name) {
    }

    /** A Zabbix tag (host, template, item or trigger). */
    public record Tag(@NotBlank @Size(max = 255) String tag, @Size(max = 255) String value) {
        public Tag {
            tag = tag == null ? null : tag.strip();
            value = value == null ? "" : value.strip();
        }
    }

    public record HostDto(String id, String host, String name, boolean enabled,
                          List<String> groups, List<Ref> templates) {
    }

    /** A trigger currently in problem state on a host. since = epoch seconds of the last state change. */
    public record ProblemDto(String hostId, String triggerId, String name, int severity, long since) {
    }

    /** A template linked to a host, with how many items, triggers and web checks it has. */
    public record TemplateSummaryDto(String id, String name, int items, int triggers, int web,
                                     int macros, int tags) {
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    public record SessionInfo(String username) {
    }

    public record ServerInfo(boolean reachable) {
    }

    /** A trigger severity as configured in Zabbix (Administration → General → Trigger displaying options). */
    public record SeverityDto(int value, String name, String color) {
    }

    /** Enable or disable monitoring of hosts. */
    public record HostStatusRequest(
            @NotEmpty @Size(max = 500) List<@Pattern(regexp = "\\d+") String> hostIds,
            @NotNull Boolean enabled) {
    }

    /** Enable or disable several template triggers at once. */
    public record TriggerStatusRequest(
            @NotEmpty @Size(max = 500) List<@Pattern(regexp = "\\d+") String> triggerIds,
            @NotNull Boolean enabled) {
    }

    /** Enable or disable one template object (web scenario). */
    public record StatusRequest(@NotNull Boolean enabled) {
    }

    // ------------------------------------------------------------ template view

    /**
     * One item of the template (edited on the template). hostEnabled is the status of this host's copy,
     * which can differ if it was switched off directly on the host in Zabbix.
     */
    public record ItemDto(String id, String name, String key, String delay, String history, String trends,
                          boolean enabled, boolean hostEnabled, String description, List<Tag> tags,
                          boolean supportsInterval, boolean supportsTrends) {
    }

    /**
     * A macro defined on the template. Edits change the template's value.
     * hostValue/hostMacroId are set when this host has its own value that takes precedence.
     */
    public record MacroDto(String macro, String type, String value, String description,
                           boolean hostOverride, String hostMacroId, String hostValue) {
    }

    /** A template trigger (edited on the template). hostEnabled: status of this host's copy. */
    public record TriggerDto(String templateTriggerId, String hostTriggerId, String name, int severity,
                             String expression, boolean enabled, boolean hostEnabled, List<Tag> tags) {
    }

    public record WebStepDto(String id, String name, String url, String statusCodes, String timeout) {
    }

    /** A template web scenario (edited on the template). hostEnabled: status of this host's copy. */
    public record WebScenarioDto(String templateScenarioId, String hostScenarioId, String name, String delay,
                                 boolean enabled, boolean hostEnabled, List<WebStepDto> steps) {
    }

    /** Everything the template editor shows for one host + template pair. */
    public record TemplateView(Ref host, Ref template, int templateHostCount, List<ItemDto> items,
                               List<MacroDto> macros, List<Tag> templateTags, List<Tag> hostTags,
                               List<TriggerDto> triggers, List<WebScenarioDto> webScenarios) {
    }

    // ----------------------------------------------------------------- requests

    /** Changes to a template item. Null fields are left unchanged. */
    public record ItemUpdateRequest(
            @Size(max = 255) String delay,
            @Size(max = 255) String history,
            @Size(max = 255) String trends,
            Boolean enabled,
            @Size(max = 65535) String description,
            @Size(max = 100) List<@Valid Tag> tags) {
    }

    public record TagsRequest(@NotNull @Size(max = 100) List<@Valid Tag> tags) {
    }

    /** Change the value of a macro on the template. */
    public record MacroRequest(@NotBlank @Size(max = 255) String macro, @NotNull @Size(max = 2048) String value) {
    }

    /** Template trigger changes. Null fields are left unchanged. */
    public record TriggerUpdateRequest(
            @Size(min = 1, max = 255) String name,
            @Min(0) @Max(5) Integer severity,
            @Size(max = 100) List<@Valid Tag> tags) {
    }

    /** A new single-step web check on the template. */
    public record WebCreateRequest(
            @NotBlank @Size(max = 64) String name,
            @NotBlank @Size(max = 2048) @Pattern(regexp = "(?i)https?://.+") String url,
            @NotBlank @Size(max = 255) String delay,
            @Size(max = 255) @Pattern(regexp = "[0-9,\\- ]*") String statusCodes,
            @Size(max = 255) String timeout) {
    }

    public record WebStepUpdate(
            @NotBlank @Pattern(regexp = "\\d+") String id,
            @NotBlank @Size(max = 2048) @Pattern(regexp = "(?i)https?://.+") String url,
            @Size(max = 255) @Pattern(regexp = "[0-9,\\- ]*") String statusCodes,
            @Size(max = 255) String timeout) {
    }

    /** Template web scenario changes. Null fields are left unchanged. */
    public record WebUpdateRequest(
            @Size(min = 1, max = 64) String name,
            @Size(min = 1, max = 255) String delay,
            @Size(max = 50) List<@Valid WebStepUpdate> steps) {
    }
}
