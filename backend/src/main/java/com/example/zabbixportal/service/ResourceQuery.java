package com.example.zabbixportal.service;

import java.util.List;

/**
 * How to select hosts or templates for an application.
 *
 * @param mode    APP: the application, i.e. host group name, host name or application tag contains
 *                {@code text}; NAME: name contains {@code text}; TAG: tag {@code tagName} equals
 *                {@code text}; ALL: no filter; IDS: exactly the given ids
 * @param details include linked templates/hosts and groups
 */
public record ResourceQuery(Mode mode, String text, String tagName, List<String> ids, boolean details) {

    public enum Mode { APP, NAME, TAG, ALL, IDS }

    public ResourceQuery {
        if (mode == null) {
            mode = Mode.NAME;
        }
        if ((mode == Mode.APP || mode == Mode.NAME || mode == Mode.TAG) && (text == null || text.isBlank())) {
            throw new IllegalArgumentException("An application name is required for the " + mode + " filter");
        }
        if (mode == Mode.TAG && (tagName == null || tagName.isBlank())) {
            throw new IllegalArgumentException("A tag name is required for the TAG filter");
        }
        if (mode == Mode.IDS && (ids == null || ids.isEmpty())) {
            throw new IllegalArgumentException("At least one id is required for the IDS filter");
        }
        if (ids != null && ids.stream().anyMatch(id -> !id.matches("\\d+"))) {
            throw new IllegalArgumentException("Ids must be numeric");
        }
        text = text == null ? null : text.strip();
        tagName = tagName == null ? null : tagName.strip();
    }
}
