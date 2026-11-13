// REST client for the Spring Boot backend. The Zabbix token stays on the server;
// the browser only holds the portal's session cookie.

let unauthorizedHandler = () => {};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      // Anti-CSRF: the backend rejects state-changing requests without this header.
      'X-Requested-With': 'zabbix-portal',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    let message = data?.detail || data?.message;
    if (!message && res.status === 404) {
      message = 'Portal backend not found (HTTP 404). Check that the Spring Boot backend is running and that Vite proxies /api to its port (default 8081).';
    } else if (!message && [500, 502, 503, 504].includes(res.status)) {
      message = `Portal backend is not responding (HTTP ${res.status}). Is it running on the port Vite proxies to (default 8081)?`;
    }
    const error = new Error(message || `Request failed (HTTP ${res.status})`);
    error.status = res.status;
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      unauthorizedHandler(error);
    }
    throw error;
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.append(key, String(value));
  });
  return search.toString();
}

const enc = encodeURIComponent;

export const api = {
  serverInfo: () => request('GET', '/info'),
  branding: () => request('GET', '/branding'),
  me: () => request('GET', '/auth/me'),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  severities: () => request('GET', '/severities'),

  /** filter: { mode: 'name'|'tag'|'all'|'ids', q, tag, ids } */
  hosts: (filter) => request('GET', `/hosts?${query(filter)}`),
  setHostStatus: (hostIds, enabled) => request('POST', '/hosts/status', { hostIds, enabled }),
  problems: (hostIds) => request('GET', `/hosts/problems?${query({ ids: hostIds })}`),
  templateSummary: (hostId) => request('GET', `/hosts/${enc(hostId)}/template-summary`),

  tagSuggestions: (hostId) => request('GET', `/hosts/${enc(hostId)}/tag-suggestions`),
  templateView: (hostId, templateId) => request('GET', `/hosts/${enc(hostId)}/templates/${enc(templateId)}`),

  setHostTags: (hostId, tags) => request('POST', `/hosts/${enc(hostId)}/tags`, { tags }),
  resetMacro: (hostId, hostMacroId) => request('DELETE', `/hosts/${enc(hostId)}/macros/${enc(hostMacroId)}`),

  // Template level: these change the template, so every host linked to it
  updateItem: (hostId, templateId, itemId, change) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/items/${enc(itemId)}`, change),
  setTriggerStatus: (hostId, templateId, triggerIds, enabled) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/triggers/status`, { triggerIds, enabled }),
  setWebStatus: (hostId, templateId, scenarioId, enabled) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/web/${enc(scenarioId)}/status`, { enabled }),
  setTemplateMacro: (hostId, templateId, macro, value) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/macros`, { macro, value }),
  setTemplateTags: (hostId, templateId, tags) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/tags`, { tags }),
  updateTemplateTrigger: (hostId, templateId, triggerId, change) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/triggers/${enc(triggerId)}`, change),
  createTemplateWeb: (hostId, templateId, web) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/web`, web),
  updateTemplateWeb: (hostId, templateId, scenarioId, change) =>
    request('POST', `/hosts/${enc(hostId)}/templates/${enc(templateId)}/web/${enc(scenarioId)}`, change),
};
