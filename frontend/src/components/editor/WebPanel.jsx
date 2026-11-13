import { useState } from 'react';
import {
  Box, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { api } from '../../api';
import { CardList, EditDialog, HostDiffNote, HostSwitch, ScopeNote, statusText } from './common';

const URL_RE = /^https?:\/\/.+/i;
const CODES_RE = /^[0-9,\- ]*$/;

/** Web checks (Zabbix web scenarios): edited on the template; enable/disable on this host. */
export default function WebPanel({ view, hostId, reload, openFresh, notify, compact, confirmTemplate }) {
  const [editing, setEditing] = useState(null);

  const openWeb = (w) => openFresh((v) => v.webScenarios.find((x) => x.templateScenarioId === w.templateScenarioId), setEditing);

  const toggle = async (w, enabled) => {
    if (!(await confirmTemplate(`${enabled ? 'Enabling' : 'Disabling'} the web check "${w.name}"`, [
      { label: w.name, from: statusText(w.enabled), to: statusText(enabled) },
    ]))) return;
    try {
      await api.setWebStatus(hostId, view.template.id, w.templateScenarioId, enabled);
      notify(`${w.name} ${enabled ? 'enabled' : 'disabled'} on template`);
      await reload();
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  const statusSwitch = (w) => (
    <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap">
      <HostSwitch
        checked={w.enabled}
        label={`${w.enabled ? 'Disable' : 'Enable'} web check ${w.name}`}
        onToggle={(v) => toggle(w, v)}
      />
      <HostDiffNote enabled={w.enabled} hostEnabled={w.hostEnabled} hostName={view.host.name} />
    </Stack>
  );
  const urls = (w) => w.steps.map((s) => (
    <Typography key={s.id} variant="caption" component="div" sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>
      {s.url}{s.statusCodes ? `  → ${s.statusCodes}` : ''}
    </Typography>
  ));

  return (
    <Stack spacing={2}>
      <ScopeNote template>
        Web check changes, including enable/disable, are saved on the template <b>{view.template.name}</b> (all{' '}
        {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'}).
      </ScopeNote>

      {view.webScenarios.length === 0 ? (
        <Typography color="text.secondary">This template has no web checks yet.</Typography>
      ) : compact ? (
        <CardList>
          {view.webScenarios.map((w) => (
            <Box key={w.templateScenarioId} role="button" tabIndex={0} onClick={() => openWeb(w)} sx={{ p: 1.75, cursor: 'pointer' }}>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                <Typography variant="body2" fontWeight={600}>{w.name}</Typography>
                {statusSwitch(w)}
              </Stack>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>Every {w.delay}</Typography>
              {urls(w)}
            </Box>
          ))}
        </CardList>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell>Web check</TableCell>
                <TableCell>Interval</TableCell>
                <TableCell>URL → expected status</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {view.webScenarios.map((w) => (
                <TableRow key={w.templateScenarioId} hover sx={{ cursor: 'pointer' }} onClick={() => openWeb(w)}>
                  <TableCell><Typography variant="body2" fontWeight={600}>{w.name}</Typography></TableCell>
                  <TableCell>{w.delay}</TableCell>
                  <TableCell>{urls(w)}</TableCell>
                  <TableCell>{statusSwitch(w)}</TableCell>
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={`Edit web check ${w.name}`}><EditRoundedIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editing && (
        <WebEditDialog scenario={editing} view={view} hostId={hostId} confirmTemplate={confirmTemplate} onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); notify('Web check saved on template'); await reload(); }} />
      )}
    </Stack>
  );
}

function WebEditDialog({ scenario, view, hostId, confirmTemplate, onClose, onSaved }) {
  const [name, setName] = useState(scenario.name);
  const [delay, setDelay] = useState(scenario.delay);
  const [steps, setSteps] = useState(scenario.steps.map((s) => ({ ...s })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setStep = (i, k, v) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const changedSteps = steps.filter((s, i) => {
    const o = scenario.steps[i];
    return s.url !== o.url || s.statusCodes !== o.statusCodes || s.timeout !== o.timeout;
  });
  const changed = name.trim() !== scenario.name || delay.trim() !== scenario.delay || changedSteps.length > 0;
  const valid = changed && name.trim() && delay.trim()
    && steps.every((s) => URL_RE.test(s.url.trim()) && CODES_RE.test(s.statusCodes));

  const save = async () => {
    const diffs = [];
    if (name.trim() !== scenario.name) diffs.push({ label: 'Name', from: scenario.name, to: name.trim() });
    if (delay.trim() !== scenario.delay) diffs.push({ label: 'Check every', from: scenario.delay, to: delay.trim() });
    steps.forEach((st, i) => {
      const o = scenario.steps[i];
      if (st.url.trim() !== o.url) diffs.push({ label: `Step ${i + 1} URL`, from: o.url, to: st.url.trim() });
      if (st.statusCodes.trim() !== o.statusCodes) diffs.push({ label: `Step ${i + 1} expected status`, from: o.statusCodes, to: st.statusCodes.trim() });
      if (st.timeout.trim() !== o.timeout) diffs.push({ label: `Step ${i + 1} timeout`, from: o.timeout, to: st.timeout.trim() });
    });
    if (!(await confirmTemplate(`Changing the web check "${scenario.name}"`, diffs))) return;
    setSaving(true);
    setError('');
    const change = {};
    if (name.trim() !== scenario.name) change.name = name.trim();
    if (delay.trim() !== scenario.delay) change.delay = delay.trim();
    if (changedSteps.length) {
      change.steps = changedSteps.map((s) => ({ id: s.id, url: s.url.trim(), statusCodes: s.statusCodes.trim(), timeout: s.timeout.trim() }));
    }
    try {
      await api.updateTemplateWeb(hostId, view.template.id, scenario.templateScenarioId, change);
      await onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <EditDialog title="Edit web check" error={error} saving={saving} canSave={valid} onSave={save} onClose={onClose} saveLabel="Save on template">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 64 } }} />
        <TextField label="Check every" value={delay} onChange={(e) => setDelay(e.target.value)} sx={{ maxWidth: { sm: 160 } }} />
      </Stack>
      {steps.map((s, i) => (
        <Box key={s.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Step {i + 1}: {s.name}</Typography>
          <Stack spacing={1.5}>
            <TextField label="URL" value={s.url} onChange={(e) => setStep(i, 'url', e.target.value)} error={!URL_RE.test(s.url.trim())} />
            <Stack direction="row" spacing={1.5}>
              <TextField label="Expected status codes" value={s.statusCodes} onChange={(e) => setStep(i, 'statusCodes', e.target.value)} error={!CODES_RE.test(s.statusCodes)} />
              <TextField label="Timeout" value={s.timeout} onChange={(e) => setStep(i, 'timeout', e.target.value)} />
            </Stack>
          </Stack>
        </Box>
      ))}
      <Typography variant="caption" color="warning.dark">
        Saved on the template {view.template.name}: all {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'} get this change.
        Other settings of the web check (headers, POST data, required text) are kept as they are.
      </Typography>
    </EditDialog>
  );
}
