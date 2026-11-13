package com.example.zabbixportal.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.zabbixportal.api.dto.Dtos.HostDto;
import com.example.zabbixportal.api.dto.Dtos.ItemDto;
import com.example.zabbixportal.api.dto.Dtos.ItemUpdateRequest;
import com.example.zabbixportal.api.dto.Dtos.MacroDto;
import com.example.zabbixportal.api.dto.Dtos.ProblemDto;
import com.example.zabbixportal.api.dto.Dtos.Ref;
import com.example.zabbixportal.api.dto.Dtos.TemplateSummaryDto;
import com.example.zabbixportal.api.dto.Dtos.SeverityDto;
import com.example.zabbixportal.api.dto.Dtos.Tag;
import com.example.zabbixportal.api.dto.Dtos.TemplateView;
import com.example.zabbixportal.api.dto.Dtos.TriggerDto;
import com.example.zabbixportal.api.dto.Dtos.TriggerUpdateRequest;
import com.example.zabbixportal.api.dto.Dtos.WebCreateRequest;
import com.example.zabbixportal.api.dto.Dtos.WebScenarioDto;
import com.example.zabbixportal.api.dto.Dtos.WebStepDto;
import com.example.zabbixportal.api.dto.Dtos.WebStepUpdate;
import com.example.zabbixportal.api.dto.Dtos.WebUpdateRequest;
import com.example.zabbixportal.config.ZabbixProperties;
import com.example.zabbixportal.zabbix.ZabbixApiException;
import com.example.zabbixportal.zabbix.ZabbixClient;
import com.example.zabbixportal.zabbix.ZabbixSession;
import com.example.zabbixportal.zabbix.ZabbixVersion;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Portal operations on the Zabbix API.
 *
 * Where each change is saved:
 * <ul>
 *   <li>Host: monitoring on/off (host.update), host tags (host.update), removing a host's own macro value.</li>
 *   <li>Template (affects every host linked to it): items incl. enable/disable (item.update), triggers incl.
 *       enable/disable (trigger.update), web checks incl. enable/disable (httptest.update), macro values
 *       (usermacro.update), template tags (template.update). Zabbix copies these to all linked hosts.</li>
 * </ul>
 * Every operation first checks that the template is linked to the host the user opened, so users can
 * only touch templates of hosts they can see.
 */
@Service
public class ZabbixService {

    private static final Logger log = LoggerFactory.getLogger(ZabbixService.class);

    /** Above this many hosts, health is not read host by host. */
    private static final int PER_HOST_LIMIT = 50;

    /** Item types that have no update interval: Zabbix trapper, SNMP trap, Dependent item. */
    private static final Set<Integer> NO_INTERVAL_TYPES = Set.of(2, 17, 18);
    /** Value types that keep trends: numeric float, numeric unsigned. */
    private static final Set<Integer> TREND_VALUE_TYPES = Set.of(0, 3);

    private final ZabbixClient client;
    private final ZabbixProperties props;

    /** Host tag that names the application, when the Zabbix installation uses one. */
    private final String appTag;

    public ZabbixService(ZabbixClient client, ZabbixProperties props,
                         @Value("${portal.app-tag:}") String appTag) {
        this.client = client;
        this.props = props;
        this.appTag = appTag == null || appTag.isBlank() ? null : appTag.strip();
    }

    // ------------------------------------------------------------------ hosts

    public List<HostDto> findHosts(ZabbixSession session, ResourceQuery query) {
        if (query.mode() == ResourceQuery.Mode.APP) {
            return findByApplication(session, query);
        }
        Map<String, Object> params = hostParams(session, query);
        switch (query.mode()) {
            case NAME -> {
                params.put("search", Map.of("name", query.text(), "host", query.text()));
                params.put("searchByAny", true);
            }
            case TAG -> params.put("tags", List.of(Map.of("tag", query.tagName(), "value", query.text(), "operator", 1)));
            case IDS -> params.put("hostids", query.ids());
            default -> { }
        }
        return hostGet(session, params);
    }

    /**
     * Hosts of one application. Zabbix has no "application" of its own, so the name is
     * matched against the host groups, the host names, and an application tag when one is
     * configured (portal.app-tag). A host that matches in more than one way appears once.
     */
    private List<HostDto> findByApplication(ZabbixSession session, ResourceQuery query) {
        String text = query.text();
        Map<String, HostDto> found = new LinkedHashMap<>();

        List<String> groupIds = groupIdsNamed(session, text);
        if (!groupIds.isEmpty()) {
            Map<String, Object> byGroup = hostParams(session, query);
            byGroup.put("groupids", groupIds);
            hostGet(session, byGroup).forEach(h -> found.putIfAbsent(h.id(), h));
        }

        Map<String, Object> byName = hostParams(session, query);
        byName.put("search", Map.of("name", text, "host", text));
        byName.put("searchByAny", true);
        hostGet(session, byName).forEach(h -> found.putIfAbsent(h.id(), h));

        if (appTag != null) {
            Map<String, Object> byTag = hostParams(session, query);
            byTag.put("tags", List.of(Map.of("tag", appTag, "value", text, "operator", 0))); // 0 = contains
            hostGet(session, byTag).forEach(h -> found.putIfAbsent(h.id(), h));
        }

        List<HostDto> hosts = new ArrayList<>(found.values());
        hosts.sort(Comparator.comparing(h -> h.name().toLowerCase(Locale.ROOT)));
        return hosts;
    }

    /** Host groups whose name contains the text; empty when the account may not read groups. */
    private List<String> groupIdsNamed(ZabbixSession session, String text) {
        try {
            List<String> ids = new ArrayList<>();
            JsonNode groups = client.call(session, "hostgroup.get", Map.of(
                    "output", List.of("groupid"), "search", Map.of("name", text), "limit", props.resultLimit()));
            groups.forEach(g -> ids.add(g.path("groupid").asText()));
            return ids;
        } catch (ZabbixApiException e) {
            // Without hostgroup.get the search still works on host names and the application tag
            log.warn("Application search: hostgroup.get failed ({}); matching host names only", e.getMessage());
            return List.of();
        }
    }

    private Map<String, Object> hostParams(ZabbixSession session, ResourceQuery query) {
        ZabbixVersion v = session.version();
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("output", List.of("hostid", "host", "name", "status"));
        params.put("sortfield", "name");
        params.put("limit", props.resultLimit());
        if (query.details()) {
            params.put("selectParentTemplates", List.of("templateid", "name"));
            params.put(v.hasSeparateTemplateGroups() ? "selectHostGroups" : "selectGroups", List.of("name"));
        }
        return params;
    }

    private List<HostDto> hostGet(ZabbixSession session, Map<String, Object> params) {
        List<HostDto> hosts = new ArrayList<>();
        for (JsonNode h : client.call(session, "host.get", params)) {
            hosts.add(new HostDto(
                    h.path("hostid").asText(),
                    h.path("host").asText(),
                    h.path("name").asText(h.path("host").asText()),
                    "0".equals(h.path("status").asText()),
                    names(h.has("hostgroups") ? h.get("hostgroups") : h.get("groups")),
                    refs(h.get("parentTemplates"), "templateid")));
        }
        return hosts;
    }

    /**
     * host.update with one entry per host: enable (status 0) or disable (status 1) monitoring.
     * (host.massupdate was removed in Zabbix 8.0; host.update with an array works on every version.)
     */
    public void setHostStatus(ZabbixSession session, List<String> hostIds, boolean enabled) {
        List<String> ids = List.copyOf(new LinkedHashSet<>(hostIds));
        String status = enabled ? "0" : "1";
        List<Map<String, String>> params = ids.stream().map(id -> Map.of("hostid", id, "status", status)).toList();
        client.call(session, "host.update", params);
        log.info("User '{}' {} hosts {}", session.username(), enabled ? "enabled" : "disabled", ids);
    }

    /** host.update: replaces the host's own tags. */
    public void setHostTags(ZabbixSession session, String hostId, List<Tag> tags) {
        requireHost(session, hostId);
        client.call(session, "host.update", Map.of("hostid", hostId, "tags", tagParams(tags)));
        log.info("User '{}' updated tags of host {}", session.username(), hostId);
    }

    // ---------------------------------------------------------------- health

    /**
     * Triggers currently in problem state on the given hosts (enabled hosts and triggers only), most severe first.
     * Uses trigger.get (value = 1), which the portal role already allows.
     */
    public List<ProblemDto> problems(ZabbixSession session, List<String> hostIds) {
        List<String> ids = List.copyOf(new LinkedHashSet<>(hostIds));
        if (ids.isEmpty()) {
            return List.of();
        }
        Set<String> wanted = new HashSet<>(ids);
        List<ProblemDto> problems;
        try {
            problems = problemsFromEvents(session, ids, wanted);
        } catch (ZabbixApiException e) {
            // problem.get is the normal way to read what is wrong right now. Should a Zabbix
            // version or role not answer it, read the triggers that are in problem state instead.
            log.warn("Host health: problem.get failed ({}); reading the triggers instead", e.getMessage());
            problems = problemsFromTriggers(session, ids, wanted);
        }
        // Worst first, newest first within a severity
        problems.sort(Comparator.comparingInt(ProblemDto::severity).reversed()
                .thenComparing(Comparator.comparingLong(ProblemDto::since).reversed()));
        return problems;
    }

    /** The open problems of these hosts, from the Zabbix problem list (problem.get). */
    private List<ProblemDto> problemsFromEvents(ZabbixSession session, List<String> ids, Set<String> wanted) {
        JsonNode events = problemGet(session, ids);
        if (!events.elements().hasNext()) {
            return new ArrayList<>();
        }
        // A problem names its trigger, not its host. With one host (the host page) that
        // is all we need; for a list of hosts the triggers say which host each belongs to.
        if (ids.size() == 1) {
            return collect(events, Map.of(), ids.get(0), wanted);
        }
        try {
            return collect(events, hostsOfTriggers(session, events), null, wanted);
        } catch (ZabbixApiException e) {
            if (ids.size() > PER_HOST_LIMIT) {
                throw e;
            }
            // Last resort on a Zabbix that will not answer that lookup: ask host by host.
            log.warn("Host health: reading the triggers of the problems failed ({}); asking per host", e.getMessage());
            List<ProblemDto> problems = new ArrayList<>();
            for (String hostId : ids) {
                problems.addAll(collect(problemGet(session, List.of(hostId)), Map.of(), hostId, wanted));
            }
            return problems;
        }
    }

    private JsonNode problemGet(ZabbixSession session, List<String> hostIds) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("hostids", hostIds);
        params.put("output", List.of("eventid", "objectid", "name", "severity", "clock"));
        params.put("source", 0);   // trigger events
        params.put("object", 0);   // trigger
        params.put("sortfield", List.of("eventid"));
        params.put("sortorder", "DESC");
        params.put("limit", props.resultLimit());
        return client.call(session, "problem.get", params);
    }

    /** triggerid -> the hosts it belongs to, and its name as a stand-in for an empty problem name. */
    private Map<String, List<String>> hostsOfTriggers(ZabbixSession session, JsonNode events) {
        List<String> triggerIds = new ArrayList<>();
        events.forEach(e -> triggerIds.add(e.path("objectid").asText()));
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("triggerids", triggerIds);
        params.put("output", List.of("triggerid"));
        params.put("selectHosts", List.of("hostid"));
        params.put("limit", props.resultLimit());
        Map<String, List<String>> hostsOf = new LinkedHashMap<>();
        for (JsonNode t : client.call(session, "trigger.get", params)) {
            List<String> hosts = new ArrayList<>();
            t.path("hosts").forEach(h -> hosts.add(h.path("hostid").asText()));
            hostsOf.put(t.path("triggerid").asText(), hosts);
        }
        return hostsOf;
    }

    /** Problems as the portal shows them: one per event and host. */
    private List<ProblemDto> collect(JsonNode events, Map<String, List<String>> hostsOfTrigger,
                                     String onlyHost, Set<String> wanted) {
        List<ProblemDto> problems = new ArrayList<>();
        for (JsonNode e : events) {
            String triggerId = e.path("objectid").asText();
            String name = e.path("name").asText("");
            List<String> hosts = onlyHost != null ? List.of(onlyHost)
                    : hostsOfTrigger.getOrDefault(triggerId, List.of());
            for (String hostId : hosts) {
                if (wanted.contains(hostId)) {
                    problems.add(new ProblemDto(hostId, triggerId, name.isBlank() ? "Problem" : name,
                            e.path("severity").asInt(0), e.path("clock").asLong(0)));
                }
            }
        }
        return problems;
    }

    /** Fallback: the triggers that are in problem state (trigger.get with value = 1). */
    private List<ProblemDto> problemsFromTriggers(ZabbixSession session, List<String> ids, Set<String> wanted) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("hostids", ids);
        params.put("output", List.of("triggerid", "description", "priority", "lastchange"));
        params.put("filter", Map.of("value", "1"));
        params.put("monitored", true);
        params.put("skipDependent", true);
        params.put("expandDescription", true);
        params.put("selectHosts", List.of("hostid"));
        params.put("limit", props.resultLimit());
        JsonNode result;
        try {
            result = client.call(session, "trigger.get", params);
        } catch (ZabbixApiException e) {
            // Some versions and roles reject the optional parameters above.
            log.warn("Host health: trigger.get failed ({}); asking again with fewer parameters", e.getMessage());
            Map<String, Object> basic = new LinkedHashMap<>();
            basic.put("hostids", ids);
            basic.put("output", List.of("triggerid", "description", "priority", "lastchange"));
            basic.put("filter", Map.of("value", "1"));
            basic.put("monitored", true);
            basic.put("selectHosts", List.of("hostid"));
            basic.put("limit", props.resultLimit());
            result = client.call(session, "trigger.get", basic);
        }
        List<ProblemDto> problems = new ArrayList<>();
        for (JsonNode t : result) {
            for (JsonNode h : t.path("hosts")) {
                String hostId = h.path("hostid").asText();
                if (wanted.contains(hostId)) {
                    problems.add(new ProblemDto(hostId, t.path("triggerid").asText(), t.path("description").asText(),
                            t.path("priority").asInt(0), t.path("lastchange").asLong(0)));
                }
            }
        }
        return problems;
    }

    /** The host's linked templates with their item, trigger and web check counts. */
    public List<TemplateSummaryDto> templateSummary(ZabbixSession session, String hostId) {
        JsonNode host = requireHost(session, hostId);
        List<String> templateIds = new ArrayList<>();
        host.path("parentTemplates").forEach(t -> templateIds.add(t.path("templateid").asText()));
        if (templateIds.isEmpty()) {
            return List.of();
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("templateids", templateIds);
        params.put("output", List.of("templateid", "name"));
        params.put("selectItems", "count");
        params.put("selectTriggers", "count");
        params.put("selectHttpTests", "count");
        // Macros and tags come back as lists (Zabbix has no count for them), so they are counted here.
        params.put("selectMacros", List.of("hostmacroid"));
        params.put("selectTags", List.of("tag"));
        params.put("sortfield", "name");
        List<TemplateSummaryDto> list = new ArrayList<>();
        for (JsonNode t : client.call(session, "template.get", params)) {
            list.add(new TemplateSummaryDto(t.path("templateid").asText(), t.path("name").asText(),
                    t.path("items").asInt(0), t.path("triggers").asInt(0), t.path("httpTests").asInt(0),
                    t.path("macros").size(), t.path("tags").size()));
        }
        return list;
    }

    // ------------------------------------------------------------- severities

    private static final String[][] DEFAULT_SEVERITIES = {
        {"Not classified", "97AAB3"}, {"Information", "7499FF"}, {"Warning", "FFC859"},
        {"Average", "FFA059"}, {"High", "E97659"}, {"Disaster", "E45959"}};

    /**
     * Severity names and colours as configured in Zabbix (settings.get, Zabbix 5.2+).
     * Falls back to the Zabbix defaults if they can't be read.
     */
    public List<SeverityDto> severities(ZabbixSession session) {
        JsonNode settings = null;
        try {
            settings = client.call(session, "settings.get", Map.of("output", "extend"));
        } catch (RuntimeException e) {
            log.debug("settings.get not available, using default severities: {}", e.getMessage());
        }
        List<SeverityDto> list = new ArrayList<>();
        for (int i = 0; i < DEFAULT_SEVERITIES.length; i++) {
            String name = settings == null ? "" : settings.path("severity_name_" + i).asText("");
            String color = settings == null ? "" : settings.path("severity_color_" + i).asText("");
            list.add(new SeverityDto(i,
                    name.isBlank() ? DEFAULT_SEVERITIES[i][0] : name,
                    "#" + (color.matches("[0-9A-Fa-f]{6}") ? color : DEFAULT_SEVERITIES[i][1])));
        }
        return list;
    }

    // -------------------------------------------------------- tag suggestions

    /**
     * Tag names and values that already exist in Zabbix, for autocomplete: tags of all hosts and templates
     * the user can see, and of this host's items, triggers and web checks. Read live on every call.
     */
    public Map<String, List<String>> tagSuggestions(ZabbixSession session, String hostId) {
        requireHost(session, hostId);
        Map<String, java.util.TreeSet<String>> tags = new java.util.TreeMap<>();
        collectTags(session, tags, "host.get", Map.of("output", List.of("hostid"), "selectTags", List.of("tag", "value"),
                "limit", props.resultLimit()));
        collectTags(session, tags, "template.get", Map.of("output", List.of("templateid"), "selectTags", List.of("tag", "value"),
                "limit", props.resultLimit()));
        collectTags(session, tags, "item.get", Map.of("hostids", List.of(hostId), "output", List.of("itemid"),
                "selectTags", List.of("tag", "value")));
        collectTags(session, tags, "trigger.get", Map.of("hostids", List.of(hostId), "output", List.of("triggerid"),
                "selectTags", List.of("tag", "value")));
        collectTags(session, tags, "httptest.get", Map.of("hostids", List.of(hostId), "output", List.of("httptestid"),
                "selectTags", List.of("tag", "value")));

        Map<String, List<String>> result = new LinkedHashMap<>();
        tags.forEach((name, values) -> result.put(name, values.stream().limit(200).toList()));
        return result;
    }

    private void collectTags(ZabbixSession session, Map<String, java.util.TreeSet<String>> into, String method,
                             Map<String, Object> params) {
        try {
            for (JsonNode o : client.call(session, method, params)) {
                for (JsonNode t : o.path("tags")) {
                    String tag = t.path("tag").asText("");
                    if (!tag.isBlank()) {
                        java.util.TreeSet<String> values = into.computeIfAbsent(tag, k -> new java.util.TreeSet<>());
                        String value = t.path("value").asText("");
                        if (!value.isBlank()) {
                            values.add(value);
                        }
                    }
                }
            }
        } catch (com.example.zabbixportal.zabbix.ZabbixApiException e) {
            if (e.isSessionExpired()) {
                throw e;
            }
            // Older Zabbix versions lack tags on some objects (or the role blocks the method): skip that source.
            log.debug("Tag suggestions: {} skipped: {}", method, e.getMessage());
        }
    }

    // ------------------------------------------------------- template editor

    public TemplateView templateView(ZabbixSession session, String hostId, String templateId) {
        JsonNode host = requireHost(session, hostId);
        requireLinked(host, templateId);

        Map<String, Object> tParams = new LinkedHashMap<>();
        tParams.put("templateids", List.of(templateId));
        tParams.put("output", List.of("templateid", "name"));
        tParams.put("selectTags", List.of("tag", "value"));
        tParams.put("selectMacros", "extend");
        tParams.put("selectHosts", "count");
        JsonNode templates = client.call(session, "template.get", tParams);
        if (templates.isEmpty()) {
            throw new IllegalArgumentException("Template not found or you have no access to it");
        }
        JsonNode template = templates.get(0);

        return new TemplateView(
                new Ref(host.path("hostid").asText(), host.path("name").asText()),
                new Ref(template.path("templateid").asText(), template.path("name").asText()),
                template.path("hosts").asInt(0),
                items(session, hostId, templateId),
                macros(template, host),
                tags(template.get("tags")),
                tags(host.get("tags")),
                triggers(session, hostId, templateId),
                webScenarios(session, hostId, templateId));
    }

    private List<ItemDto> items(ZabbixSession session, String hostId, String templateId) {
        Map<String, String> hostStatus = copyStatus(session, "item.get", "itemid", hostId);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("templateids", List.of(templateId));
        params.put("output", List.of("itemid", "name", "key_", "type", "value_type", "delay", "history",
                "trends", "status", "description", "flags"));
        params.put("selectTags", List.of("tag", "value"));
        params.put("sortfield", "name");
        List<ItemDto> items = new ArrayList<>();
        for (JsonNode i : client.call(session, "item.get", params)) {
            if (!"0".equals(i.path("flags").asText("0"))) {
                continue;
            }
            String id = i.path("itemid").asText();
            boolean enabled = "0".equals(i.path("status").asText());
            items.add(new ItemDto(
                    id,
                    i.path("name").asText(),
                    i.path("key_").asText(),
                    i.path("delay").asText(),
                    i.path("history").asText(),
                    i.path("trends").asText(),
                    enabled,
                    hostStatus.containsKey(id) ? "0".equals(hostStatus.get(id)) : enabled,
                    i.path("description").asText(""),
                    tags(i.get("tags")),
                    !NO_INTERVAL_TYPES.contains(i.path("type").asInt()),
                    TREND_VALUE_TYPES.contains(i.path("value_type").asInt())));
        }
        return items;
    }

    /** templateid → status of this host's copies (items, triggers or web scenarios). */
    private Map<String, String> copyStatus(ZabbixSession session, String method, String idField, String hostId) {
        Map<String, String> status = new HashMap<>();
        for (JsonNode c : client.call(session, method, Map.of(
                "hostids", List.of(hostId), "inherited", true, "output", List.of(idField, "templateid", "status")))) {
            status.put(c.path("templateid").asText(), c.path("status").asText());
        }
        return status;
    }

    private static List<MacroDto> macros(JsonNode template, JsonNode host) {
        Map<String, JsonNode> hostMacros = new HashMap<>();
        for (JsonNode m : host.path("macros")) {
            hostMacros.put(m.path("macro").asText(), m);
        }
        List<MacroDto> macros = new ArrayList<>();
        for (JsonNode m : template.path("macros")) {
            String name = m.path("macro").asText();
            JsonNode override = hostMacros.get(name);
            macros.add(new MacroDto(
                    name,
                    macroType(m.path("type").asText("0")),
                    m.has("value") ? m.get("value").asText() : null,
                    m.path("description").asText(""),
                    override != null,
                    override == null ? null : override.path("hostmacroid").asText(),
                    override == null || !override.has("value") ? null : override.get("value").asText()));
        }
        return macros;
    }

    private List<TriggerDto> triggers(ZabbixSession session, String hostId, String templateId) {
        Map<String, Object> tParams = new LinkedHashMap<>();
        tParams.put("templateids", List.of(templateId));
        tParams.put("output", List.of("triggerid", "description", "priority", "expression", "status"));
        tParams.put("selectTags", List.of("tag", "value"));
        tParams.put("expandExpression", true);
        tParams.put("sortfield", "description");
        JsonNode templateTriggers = client.call(session, "trigger.get", tParams);

        // The host's copies point back to the template trigger through templateid.
        Map<String, JsonNode> hostCopies = new HashMap<>();
        for (JsonNode t : client.call(session, "trigger.get", Map.of(
                "hostids", List.of(hostId), "inherited", true, "output", List.of("triggerid", "templateid", "status")))) {
            hostCopies.put(t.path("templateid").asText(), t);
        }

        List<TriggerDto> triggers = new ArrayList<>();
        for (JsonNode t : templateTriggers) {
            JsonNode copy = hostCopies.get(t.path("triggerid").asText());
            boolean enabled = "0".equals(t.path("status").asText());
            triggers.add(new TriggerDto(
                    t.path("triggerid").asText(),
                    copy == null ? null : copy.path("triggerid").asText(),
                    t.path("description").asText(),
                    t.path("priority").asInt(0),
                    t.path("expression").asText(""),
                    enabled,
                    copy == null ? enabled : "0".equals(copy.path("status").asText()),
                    tags(t.get("tags"))));
        }
        return triggers;
    }

    private List<WebScenarioDto> webScenarios(ZabbixSession session, String hostId, String templateId) {
        Map<String, Object> wParams = new LinkedHashMap<>();
        wParams.put("templateids", List.of(templateId));
        wParams.put("output", List.of("httptestid", "name", "delay", "status"));
        wParams.put("selectSteps", List.of("httpstepid", "name", "url", "status_codes", "timeout", "no"));
        JsonNode templateScenarios = client.call(session, "httptest.get", wParams);

        Map<String, JsonNode> hostCopies = new HashMap<>();
        for (JsonNode w : client.call(session, "httptest.get", Map.of(
                "hostids", List.of(hostId), "inherited", true, "output", List.of("httptestid", "templateid", "status")))) {
            hostCopies.put(w.path("templateid").asText(), w);
        }

        List<WebScenarioDto> scenarios = new ArrayList<>();
        for (JsonNode w : templateScenarios) {
            JsonNode copy = hostCopies.get(w.path("httptestid").asText());
            List<JsonNode> stepNodes = new ArrayList<>();
            w.path("steps").forEach(stepNodes::add);
            stepNodes.sort((a, b) -> Integer.compare(a.path("no").asInt(), b.path("no").asInt()));
            List<WebStepDto> steps = new ArrayList<>();
            for (JsonNode s : stepNodes) {
                steps.add(new WebStepDto(s.path("httpstepid").asText(), s.path("name").asText(), s.path("url").asText(),
                        s.path("status_codes").asText(""), s.path("timeout").asText("")));
            }
            boolean enabled = "0".equals(w.path("status").asText());
            scenarios.add(new WebScenarioDto(
                    w.path("httptestid").asText(),
                    copy == null ? null : copy.path("httptestid").asText(),
                    w.path("name").asText(),
                    w.path("delay").asText(),
                    enabled,
                    copy == null ? enabled : "0".equals(copy.path("status").asText()),
                    steps));
        }
        scenarios.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return scenarios;
    }

    // ------------------------------------------------------- host-level edits

    /** item.update on the template's item (Zabbix copies the change to every linked host). */
    public void updateItem(ZabbixSession session, String hostId, String templateId, String itemId,
                           ItemUpdateRequest change) {
        requireLinked(requireHost(session, hostId), templateId);
        Map<String, Object> lookup = new LinkedHashMap<>();
        lookup.put("itemids", List.of(itemId));
        lookup.put("templateids", List.of(templateId));
        lookup.put("output", List.of("itemid", "type", "value_type", "flags"));
        JsonNode found = client.call(session, "item.get", lookup);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Item not found on this template");
        }
        JsonNode item = found.get(0);
        if (!"0".equals(item.path("flags").asText("0"))) {
            throw new IllegalArgumentException("Discovered items cannot be edited");
        }

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("itemid", itemId);
        if (change.delay() != null && !NO_INTERVAL_TYPES.contains(item.path("type").asInt())) {
            params.put("delay", requireText(change.delay(), "Update interval"));
        }
        if (change.history() != null) {
            params.put("history", requireText(change.history(), "History"));
        }
        if (change.trends() != null && TREND_VALUE_TYPES.contains(item.path("value_type").asInt())) {
            params.put("trends", requireText(change.trends(), "Trends"));
        }
        if (change.enabled() != null) {
            params.put("status", change.enabled() ? "0" : "1");
        }
        if (change.description() != null) {
            params.put("description", change.description());
        }
        if (change.tags() != null) {
            params.put("tags", tagParams(change.tags()));
        }
        if (params.size() == 1) {
            return;
        }
        client.call(session, "item.update", params);
        log.info("User '{}' updated item {} on template {}: {}", session.username(), itemId, templateId, params.keySet());
    }

    /** trigger.update status on template triggers, one or many (copied to every linked host). */
    public void setTriggerStatus(ZabbixSession session, String hostId, String templateId, List<String> triggerIds,
                                 boolean enabled) {
        requireLinked(requireHost(session, hostId), templateId);
        List<String> ids = List.copyOf(new LinkedHashSet<>(triggerIds));
        JsonNode found = client.call(session, "trigger.get", Map.of(
                "triggerids", ids, "templateids", List.of(templateId), "output", List.of("triggerid")));
        if (found.size() != ids.size()) {
            throw new IllegalArgumentException("Some triggers were not found on this template");
        }
        String status = enabled ? "0" : "1";
        client.call(session, "trigger.update", ids.stream().map(id -> Map.of("triggerid", id, "status", status)).toList());
        log.info("User '{}' {} triggers {} on template {}", session.username(), enabled ? "enabled" : "disabled", ids,
                templateId);
    }

    /** httptest.update status on the template's web scenario (copied to every linked host). */
    public void setWebStatus(ZabbixSession session, String hostId, String templateId, String scenarioId,
                             boolean enabled) {
        requireLinked(requireHost(session, hostId), templateId);
        JsonNode found = client.call(session, "httptest.get", Map.of(
                "httptestids", List.of(scenarioId), "templateids", List.of(templateId), "output", List.of("httptestid")));
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Web check not found on this template");
        }
        client.call(session, "httptest.update", Map.of("httptestid", scenarioId, "status", enabled ? "0" : "1"));
        log.info("User '{}' {} web scenario {} on template {}", session.username(), enabled ? "enabled" : "disabled",
                scenarioId, templateId);
    }

    /** Deletes the host's own value of a macro, so the template value applies again. */
    public void resetMacro(ZabbixSession session, String hostId, String hostMacroId) {
        JsonNode found = client.call(session, "usermacro.get", Map.of(
                "hostmacroids", List.of(hostMacroId), "hostids", List.of(hostId), "output", List.of("hostmacroid", "macro")));
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Macro override not found on this host");
        }
        client.call(session, "usermacro.delete", List.of(hostMacroId));
        log.info("User '{}' removed host value of macro {} on host {}", session.username(),
                found.get(0).path("macro").asText(), hostId);
    }

    // --------------------------------------------------- template-level edits

    /** usermacro.update on the template's macro (affects every host linked to the template). */
    public void setTemplateMacro(ZabbixSession session, String hostId, String templateId, String macro, String value) {
        requireLinked(requireHost(session, hostId), templateId);
        JsonNode found = client.call(session, "usermacro.get", Map.of(
                "hostids", List.of(templateId), "filter", Map.of("macro", macro), "output", List.of("hostmacroid", "macro")));
        if (found.isEmpty()) {
            throw new IllegalArgumentException("This macro is not defined on the template");
        }
        client.call(session, "usermacro.update", Map.of("hostmacroid", found.get(0).path("hostmacroid").asText(), "value", value));
        log.info("User '{}' set macro {} on template {}", session.username(), macro, templateId);
    }

    /** template.update: replaces the template's tags. */
    public void setTemplateTags(ZabbixSession session, String hostId, String templateId, List<Tag> tags) {
        requireLinked(requireHost(session, hostId), templateId);
        client.call(session, "template.update", Map.of("templateid", templateId, "tags", tagParams(tags)));
        log.info("User '{}' updated tags of template {}", session.username(), templateId);
    }

    /** trigger.update on the template's trigger: name, severity, tags. */
    public void updateTemplateTrigger(ZabbixSession session, String hostId, String templateId, String triggerId,
                                      TriggerUpdateRequest change) {
        requireLinked(requireHost(session, hostId), templateId);
        JsonNode found = client.call(session, "trigger.get", Map.of(
                "triggerids", List.of(triggerId), "templateids", List.of(templateId), "output", List.of("triggerid")));
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Trigger not found on this template");
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("triggerid", triggerId);
        if (change.name() != null) {
            params.put("description", requireText(change.name(), "Name"));
        }
        if (change.severity() != null) {
            params.put("priority", String.valueOf(change.severity()));
        }
        if (change.tags() != null) {
            params.put("tags", tagParams(change.tags()));
        }
        if (params.size() == 1) {
            return;
        }
        client.call(session, "trigger.update", params);
        log.info("User '{}' updated trigger {} on template {}: {}", session.username(), triggerId, templateId, params.keySet());
    }

    /** httptest.create on the template: Zabbix adds it to every host linked to the template. */
    public void createTemplateWeb(ZabbixSession session, String hostId, String templateId, WebCreateRequest web) {
        requireLinked(requireHost(session, hostId), templateId);
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("name", web.name().strip());
        step.put("url", web.url().strip());
        step.put("no", 1);
        if (web.statusCodes() != null && !web.statusCodes().isBlank()) {
            step.put("status_codes", web.statusCodes().replace(" ", ""));
        }
        if (web.timeout() != null && !web.timeout().isBlank()) {
            step.put("timeout", web.timeout().strip());
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("hostid", templateId);
        params.put("name", web.name().strip());
        params.put("delay", web.delay().strip());
        params.put("steps", List.of(step));
        client.call(session, "httptest.create", params);
        log.info("User '{}' added web scenario '{}' to template {}", session.username(), web.name(), templateId);
    }

    /** httptest.update on the template's web scenario: name, interval, step URL/status codes/timeout. */
    public void updateTemplateWeb(ZabbixSession session, String hostId, String templateId, String scenarioId,
                                  WebUpdateRequest change) {
        requireLinked(requireHost(session, hostId), templateId);
        Map<String, Object> lookup = new LinkedHashMap<>();
        lookup.put("httptestids", List.of(scenarioId));
        lookup.put("templateids", List.of(templateId));
        lookup.put("output", List.of("httptestid"));
        lookup.put("selectSteps", "extend");
        JsonNode found = client.call(session, "httptest.get", lookup);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Web check not found on this template");
        }

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("httptestid", scenarioId);
        if (change.name() != null) {
            params.put("name", requireText(change.name(), "Name"));
        }
        if (change.delay() != null) {
            params.put("delay", requireText(change.delay(), "Update interval"));
        }
        if (change.steps() != null && !change.steps().isEmpty()) {
            Map<String, WebStepUpdate> updates = new HashMap<>();
            change.steps().forEach(s -> updates.put(s.id(), s));
            // Zabbix replaces the whole step list on update, so send every step back with ALL of its
            // fields (headers, posts, required string, ...), changing only what the user edited.
            List<ObjectNode> steps = new ArrayList<>();
            for (JsonNode s : found.get(0).path("steps")) {
                ObjectNode step = ((ObjectNode) s).deepCopy();
                step.remove("httptestid");
                WebStepUpdate u = updates.remove(s.path("httpstepid").asText());
                if (u != null) {
                    step.put("url", u.url().strip());
                    if (u.statusCodes() != null) {
                        step.put("status_codes", u.statusCodes().replace(" ", ""));
                    }
                    if (u.timeout() != null && !u.timeout().isBlank()) {
                        step.put("timeout", u.timeout().strip());
                    }
                }
                steps.add(step);
            }
            if (!updates.isEmpty()) {
                throw new IllegalArgumentException("Unknown web check step");
            }
            params.put("steps", steps);
        }
        if (params.size() == 1) {
            return;
        }
        client.call(session, "httptest.update", params);
        log.info("User '{}' updated web scenario {} on template {}: {}", session.username(), scenarioId, templateId,
                params.keySet());
    }

    // ---------------------------------------------------------------- helpers

    private JsonNode requireHost(ZabbixSession session, String hostId) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("hostids", List.of(hostId));
        params.put("output", List.of("hostid", "host", "name", "status"));
        params.put("selectParentTemplates", List.of("templateid", "name"));
        params.put("selectTags", List.of("tag", "value"));
        params.put("selectMacros", "extend");
        JsonNode hosts = client.call(session, "host.get", params);
        if (hosts.isEmpty()) {
            throw new IllegalArgumentException("Host not found or you have no access to it");
        }
        return hosts.get(0);
    }

    private static void requireLinked(JsonNode host, String templateId) {
        for (JsonNode t : host.path("parentTemplates")) {
            if (templateId.equals(t.path("templateid").asText())) {
                return;
            }
        }
        throw new IllegalArgumentException("This template is not linked to the host");
    }

    private static String requireText(String value, String field) {
        String v = value.strip();
        if (v.isEmpty()) {
            throw new IllegalArgumentException(field + " cannot be empty");
        }
        return v;
    }

    private static String macroType(String type) {
        return switch (type) {
            case "1" -> "secret";
            case "2" -> "vault";
            default -> "text";
        };
    }

    private static List<Map<String, String>> tagParams(List<Tag> tags) {
        return tags.stream().map(t -> Map.of("tag", t.tag(), "value", t.value() == null ? "" : t.value())).toList();
    }

    private static List<Tag> tags(JsonNode array) {
        List<Tag> tags = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(t -> tags.add(new Tag(t.path("tag").asText(), t.path("value").asText(""))));
        }
        return tags;
    }

    private static List<String> names(JsonNode array) {
        List<String> names = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(n -> names.add(n.path("name").asText()));
        }
        return names;
    }

    private static List<Ref> refs(JsonNode array, String idField) {
        List<Ref> refs = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(n -> refs.add(new Ref(n.path(idField).asText(), n.path("name").asText())));
        }
        return refs;
    }
}
