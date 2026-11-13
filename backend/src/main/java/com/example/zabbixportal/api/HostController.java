package com.example.zabbixportal.api;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.zabbixportal.api.dto.Dtos.HostDto;
import com.example.zabbixportal.api.dto.Dtos.HostStatusRequest;
import com.example.zabbixportal.api.dto.Dtos.ItemUpdateRequest;
import com.example.zabbixportal.api.dto.Dtos.MacroRequest;
import com.example.zabbixportal.api.dto.Dtos.ProblemDto;
import com.example.zabbixportal.api.dto.Dtos.TemplateSummaryDto;
import com.example.zabbixportal.api.dto.Dtos.StatusRequest;
import com.example.zabbixportal.api.dto.Dtos.TagsRequest;
import com.example.zabbixportal.api.dto.Dtos.TemplateView;
import com.example.zabbixportal.api.dto.Dtos.TriggerStatusRequest;
import com.example.zabbixportal.api.dto.Dtos.TriggerUpdateRequest;
import com.example.zabbixportal.api.dto.Dtos.WebCreateRequest;
import com.example.zabbixportal.api.dto.Dtos.WebUpdateRequest;
import com.example.zabbixportal.service.ResourceQuery;
import com.example.zabbixportal.service.ZabbixService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/hosts")
public class HostController {

    private static final String ID = "\\d+";

    private final ZabbixService service;
    private final SessionSupport sessions;

    public HostController(ZabbixService service, SessionSupport sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    /**
     * Zabbix host.get
     *
     * @param mode    app | name | tag | all | ids
     * @param q       application name (for name/tag)
     * @param tag     tag name (for mode=tag)
     * @param ids     host ids (for mode=ids)
     */
    @GetMapping
    public List<HostDto> hosts(@RequestParam(defaultValue = "app") String mode,
                               @RequestParam(required = false) String q,
                               @RequestParam(required = false) String tag,
                               @RequestParam(required = false) List<String> ids,
                               HttpServletRequest request) {
        ResourceQuery.Mode m;
        try {
            m = ResourceQuery.Mode.valueOf(mode.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("mode must be one of: app, name, tag, all, ids");
        }
        return service.findHosts(sessions.require(request), new ResourceQuery(m, q, tag, ids, true));
    }

    /** Live health: triggers currently in problem state on these hosts (trigger.get, value = 1). */
    @GetMapping("/problems")
    public List<ProblemDto> problems(@RequestParam List<String> ids, HttpServletRequest request) {
        if (ids.size() > 2000 || ids.stream().anyMatch(i -> !i.matches(ID))) {
            throw new IllegalArgumentException("Invalid host ids");
        }
        return service.problems(sessions.require(request), ids);
    }

    /** Linked templates with item / trigger / web check counts. */
    @GetMapping("/{hostId}/template-summary")
    public List<TemplateSummaryDto> templateSummary(@PathVariable String hostId, HttpServletRequest request) {
        return service.templateSummary(sessions.require(request), id(hostId));
    }

    /** Zabbix host.update: enable or disable monitoring. */
    @PostMapping("/status")
    public ResponseEntity<Void> status(@Valid @RequestBody HostStatusRequest body, HttpServletRequest request) {
        service.setHostStatus(sessions.require(request), body.hostIds(), body.enabled());
        return ResponseEntity.noContent().build();
    }

    /** Items, tags and macros of one linked template, as they apply to this host. */
    @GetMapping("/{hostId}/templates/{templateId}")
    public TemplateView template(@PathVariable String hostId, @PathVariable String templateId,
                                 HttpServletRequest request) {
        return service.templateView(sessions.require(request), id(hostId), id(templateId));
    }

    /** Existing tag names/values in Zabbix, for autocomplete while editing tags. */
    @GetMapping("/{hostId}/tag-suggestions")
    public java.util.Map<String, List<String>> tagSuggestions(@PathVariable String hostId, HttpServletRequest request) {
        return service.tagSuggestions(sessions.require(request), id(hostId));
    }

    /** Zabbix host.update: replace the host's tags. */
    @PostMapping("/{hostId}/tags")
    public ResponseEntity<Void> tags(@PathVariable String hostId, @Valid @RequestBody TagsRequest body,
                                     HttpServletRequest request) {
        service.setHostTags(sessions.require(request), id(hostId), body.tags());
        return ResponseEntity.noContent().build();
    }

    /** Zabbix usermacro.delete: remove the host's own value so the template value applies again. */
    @DeleteMapping("/{hostId}/macros/{hostMacroId}")
    public ResponseEntity<Void> resetMacro(@PathVariable String hostId, @PathVariable String hostMacroId,
                                           HttpServletRequest request) {
        service.resetMacro(sessions.require(request), id(hostId), id(hostMacroId));
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------- template level (affects every linked host)

    /** Zabbix item.update on the template's item. */
    @PostMapping("/{hostId}/templates/{templateId}/items/{itemId}")
    public ResponseEntity<Void> updateItem(@PathVariable String hostId, @PathVariable String templateId,
                                           @PathVariable String itemId, @Valid @RequestBody ItemUpdateRequest body,
                                           HttpServletRequest request) {
        service.updateItem(sessions.require(request), id(hostId), id(templateId), id(itemId), body);
        return ResponseEntity.noContent().build();
    }

    /** Zabbix trigger.update: enable/disable template triggers (one or many). */
    @PostMapping("/{hostId}/templates/{templateId}/triggers/status")
    public ResponseEntity<Void> triggersStatus(@PathVariable String hostId, @PathVariable String templateId,
                                               @Valid @RequestBody TriggerStatusRequest body,
                                               HttpServletRequest request) {
        service.setTriggerStatus(sessions.require(request), id(hostId), id(templateId), body.triggerIds(), body.enabled());
        return ResponseEntity.noContent().build();
    }

    /** Zabbix httptest.update: enable/disable a template web scenario. */
    @PostMapping("/{hostId}/templates/{templateId}/web/{scenarioId}/status")
    public ResponseEntity<Void> webStatus(@PathVariable String hostId, @PathVariable String templateId,
                                          @PathVariable String scenarioId, @Valid @RequestBody StatusRequest body,
                                          HttpServletRequest request) {
        service.setWebStatus(sessions.require(request), id(hostId), id(templateId), id(scenarioId), body.enabled());
        return ResponseEntity.noContent().build();
    }

    /** Zabbix usermacro.update on the template's macro. */
    @PostMapping("/{hostId}/templates/{templateId}/macros")
    public ResponseEntity<Void> templateMacro(@PathVariable String hostId, @PathVariable String templateId,
                                              @Valid @RequestBody MacroRequest body, HttpServletRequest request) {
        service.setTemplateMacro(sessions.require(request), id(hostId), id(templateId), body.macro().strip(), body.value());
        return ResponseEntity.noContent().build();
    }

    /** Zabbix template.update: replace the template's tags. */
    @PostMapping("/{hostId}/templates/{templateId}/tags")
    public ResponseEntity<Void> templateTags(@PathVariable String hostId, @PathVariable String templateId,
                                             @Valid @RequestBody TagsRequest body, HttpServletRequest request) {
        service.setTemplateTags(sessions.require(request), id(hostId), id(templateId), body.tags());
        return ResponseEntity.noContent().build();
    }

    /** Zabbix trigger.update on the template's trigger: name, severity, tags. */
    @PostMapping("/{hostId}/templates/{templateId}/triggers/{triggerId}")
    public ResponseEntity<Void> templateTrigger(@PathVariable String hostId, @PathVariable String templateId,
                                                @PathVariable String triggerId,
                                                @Valid @RequestBody TriggerUpdateRequest body,
                                                HttpServletRequest request) {
        service.updateTemplateTrigger(sessions.require(request), id(hostId), id(templateId), id(triggerId), body);
        return ResponseEntity.noContent().build();
    }

    /** Zabbix httptest.create on the template. */
    @PostMapping("/{hostId}/templates/{templateId}/web")
    public ResponseEntity<Void> createWeb(@PathVariable String hostId, @PathVariable String templateId,
                                          @Valid @RequestBody WebCreateRequest body, HttpServletRequest request) {
        service.createTemplateWeb(sessions.require(request), id(hostId), id(templateId), body);
        return ResponseEntity.noContent().build();
    }

    /** Zabbix httptest.update on the template's web scenario. */
    @PostMapping("/{hostId}/templates/{templateId}/web/{scenarioId}")
    public ResponseEntity<Void> updateWeb(@PathVariable String hostId, @PathVariable String templateId,
                                          @PathVariable String scenarioId,
                                          @Valid @RequestBody WebUpdateRequest body, HttpServletRequest request) {
        service.updateTemplateWeb(sessions.require(request), id(hostId), id(templateId), id(scenarioId), body);
        return ResponseEntity.noContent().build();
    }

    private static String id(String value) {
        if (value == null || !value.matches(ID)) {
            throw new IllegalArgumentException("Invalid id");
        }
        return value;
    }
}
