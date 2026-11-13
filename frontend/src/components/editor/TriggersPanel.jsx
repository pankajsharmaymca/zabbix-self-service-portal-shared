import { useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, InputAdornment, Paper, Stack, Switch, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { api } from '../../api';
import { TagChipsEditor, TagChipsView } from '../TagChips';
import { cleanTags, sameTags, tagLabels } from '../TagEditor';
import { CardList, EditDialog, HostDiffNote, HostSwitch, ScopeNote, SeverityChip, statusText, tagsText } from './common';
import { useSeverities } from '../../live';
import SeverityPicker from './SeverityPicker';

/** Tags a trigger inherits: the template's and the host's. */
export function inheritedTags(view) {
  return [
    ...view.templateTags.map((t) => ({ ...t, source: 'template' })),
    ...view.hostTags.map((t) => ({ ...t, source: 'host' })),
  ];
}

/** Triggers: name, severity and tags are saved on the template; enable/disable on this host. */
export default function TriggersPanel({ view, hostId, reload, openFresh, notify, compact, confirmTemplate }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const inherited = useMemo(() => inheritedTags(view), [view]);

  const triggers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? view.triggers.filter((t) => `${t.name} ${tagLabels(t.tags).join(' ')}`.toLowerCase().includes(term))
      : view.triggers;
  }, [view.triggers, search]);

  const openTrigger = (t) => openFresh((v) => v.triggers.find((x) => x.templateTriggerId === t.templateTriggerId), setEditing);

  if (view.triggers.length === 0) {
    return <Typography color="text.secondary">This template has no triggers on this host.</Typography>;
  }

  const setStatus = async (ids, enabled, label, afterSave) => {
    const changes = view.triggers.filter((t) => ids.includes(t.templateTriggerId) && t.enabled !== enabled)
      .map((t) => ({ label: t.name, from: statusText(t.enabled), to: statusText(enabled) }));
    if (!(await confirmTemplate(`${enabled ? 'Enabling' : 'Disabling'} ${label}`, changes))) return false;
    try {
      await api.setTriggerStatus(hostId, view.template.id, ids, enabled);
      afterSave?.();          // e.g. clear the selection now, not after the reload
      notify(`${label} ${enabled ? 'enabled' : 'disabled'} on template`);
      await reload();
      return true;
    } catch (e) {
      notify(e.message, 'error');
      return false;
    }
  };

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = triggers.length > 0 && triggers.every((t) => selected.has(t.templateTriggerId));
  const someSelected = triggers.some((t) => selected.has(t.templateTriggerId));
  const toggleAll = () => setSelected((s) => {
    const next = new Set(s);
    triggers.forEach((t) => (allSelected ? next.delete(t.templateTriggerId) : next.add(t.templateTriggerId)));
    return next;
  });

  const bulk = async (enabled) => {
    setBulkBusy(true);
    const ids = [...selected];
    await setStatus(ids, enabled, `${ids.length} trigger${ids.length === 1 ? '' : 's'}`, () => setSelected(new Set()));
    setBulkBusy(false);
  };

  const statusSwitch = (t) => (
    <HostSwitch
      checked={t.enabled}
      label={`${t.enabled ? 'Disable' : 'Enable'} trigger ${t.name}`}
      onToggle={(v) => setStatus([t.templateTriggerId], v, t.name)}
    />
  );
  const statusCell = (t) => (
    <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap">
      {statusSwitch(t)}
      <HostDiffNote enabled={t.enabled} hostEnabled={t.hostEnabled} hostName={view.host.name} />
    </Stack>
  );
  const rowCheckbox = (t) => (
    <Checkbox
      size="small"
      checked={selected.has(t.templateTriggerId)}
      onClick={(e) => e.stopPropagation()}
      onChange={() => toggleSelect(t.templateTriggerId)}
      slotProps={{ input: { 'aria-label': `Select trigger ${t.name}` } }}
    />
  );

  return (
    <Stack spacing={2}>
      <ScopeNote template>
        Trigger changes, including enable/disable, are saved on the template <b>{view.template.name}</b> (all{' '}
        {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'}).
      </ScopeNote>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <TextField
          placeholder="Search triggers or tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: { sm: 360 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControlLabel
            control={<Checkbox size="small" checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} />}
            label={<Typography variant="body2">Select all</Typography>}
            sx={{ mr: 0 }}
          />
        </Stack>
      </Stack>

      {selected.size > 0 && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25, bgcolor: 'action.selected', borderColor: 'secondary.main' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
            <Typography variant="body2" fontWeight={600}>
              {selected.size} trigger{selected.size === 1 ? '' : 's'} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" color="inherit" onClick={() => setSelected(new Set())} disabled={bulkBusy}>Clear</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => bulk(false)} disabled={bulkBusy}>Disable selected</Button>
              <Button size="small" variant="contained" onClick={() => bulk(true)} disabled={bulkBusy}>Enable selected</Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {compact ? (
        <CardList>
          {triggers.map((t) => (
            <Box key={t.templateTriggerId} role="button" tabIndex={0} onClick={() => openTrigger(t)} sx={{ p: 1.5, cursor: 'pointer' }}>
              <Stack direction="row" spacing={0.5} alignItems="flex-start">
                <Box sx={{ mt: -0.75, ml: -0.75 }}>{rowCheckbox(t)}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                    <SeverityChip severity={t.severity} />
                  </Stack>
                  <Box sx={{ my: 1 }}><TagChipsView own={t.tags} inherited={inherited} /></Box>
                  {statusCell(t)}
                </Box>
              </Stack>
            </Box>
          ))}
        </CardList>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell sx={{ width: '34%' }}>Trigger</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tags</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {triggers.map((t) => (
                <TableRow key={t.templateTriggerId} hover selected={selected.has(t.templateTriggerId)} sx={{ cursor: 'pointer' }} onClick={() => openTrigger(t)}>
                  <TableCell padding="checkbox">{rowCheckbox(t)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>{t.expression}</Typography>
                  </TableCell>
                  <TableCell><SeverityChip severity={t.severity} /></TableCell>
                  <TableCell>{statusCell(t)}</TableCell>
                  <TableCell><TagChipsView own={t.tags} inherited={inherited} /></TableCell>
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={`Edit trigger ${t.name}`}><EditRoundedIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="caption" color="text.secondary">
        Filled tags belong to the trigger. Dashed tags are inherited from the template or host (change those in the Tags tab).
      </Typography>

      {editing && (
        <TriggerEditDialog
          trigger={editing}
          view={view}
          inherited={inherited}
          key={editing.templateTriggerId}
          hostId={hostId}
          confirmTemplate={confirmTemplate}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            notify(message);
            await reload();
          }}
        />
      )}
    </Stack>
  );
}

function TriggerEditDialog({ trigger, view, inherited, hostId, confirmTemplate, onClose, onSaved }) {
  const severities = useSeverities();
  const [name, setName] = useState(trigger.name);
  const [severity, setSeverity] = useState(trigger.severity);
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [tags, setTags] = useState(trigger.tags.map((t) => ({ ...t })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const templateChanged = name.trim() !== trigger.name || severity !== trigger.severity || !sameTags(tags, trigger.tags);
  const statusChanged = enabled !== trigger.enabled;
  const valid = name.trim() && (templateChanged || statusChanged);

  const save = async () => {
    const changes = [];
    if (name.trim() !== trigger.name) changes.push({ label: 'Name', from: trigger.name, to: name.trim() });
    if (severity !== trigger.severity) {
      changes.push({ label: 'Severity', from: severities[trigger.severity]?.name, to: severities[severity]?.name });
    }
    if (enabled !== trigger.enabled) changes.push({ label: 'Status', from: statusText(trigger.enabled), to: statusText(enabled) });
    if (!sameTags(tags, trigger.tags)) changes.push({ label: 'Tags', from: tagsText(trigger.tags), to: tagsText(cleanTags(tags)) });
    if (!(await confirmTemplate(`Changing the trigger "${trigger.name}"`, changes))) return;
    setSaving(true);
    setError('');
    try {
      if (templateChanged) {
        const change = {};
        if (name.trim() !== trigger.name) change.name = name.trim();
        if (severity !== trigger.severity) change.severity = severity;
        if (!sameTags(tags, trigger.tags)) change.tags = cleanTags(tags);
        await api.updateTemplateTrigger(hostId, view.template.id, trigger.templateTriggerId, change);
      }
      if (statusChanged) {
        await api.setTriggerStatus(hostId, [trigger.hostTriggerId], enabled);
      }
      await onSaved(templateChanged ? 'Trigger saved on template' : `Trigger ${enabled ? 'enabled' : 'disabled'} on ${view.host.name}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <EditDialog
      title="Edit trigger"
      subtitle={trigger.expression}
      error={error}
      saving={saving}
      canSave={valid}
      onSave={save}
      onClose={onClose}
      saveLabel="Save on template"
    >
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={!name.trim()} />

      <SeverityPicker value={severity} onChange={setSeverity} disabled={saving} />

      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <FormControlLabel
          control={<Switch color="success" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={saving} />}
          label={<Typography variant="body2" fontWeight={600}>{enabled ? 'Enabled' : 'Disabled'}</Typography>}
        />
        <Typography variant="caption" color="text.secondary" component="div">
          On the template: applies to all {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'}.
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Trigger tags</Typography>
        <TagChipsEditor tags={tags} onChange={setTags} disabled={saving} />
      </Box>

      {inherited.length > 0 && (
        <Box>
          <Typography variant="subtitle2">Inherited tags</Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
            From the template and the host. Change these in the Tags tab.
          </Typography>
          <TagChipsView inherited={inherited} />
        </Box>
      )}

      <Typography variant="caption" color="warning.dark">
        Saved on the template {view.template.name}: all {view.templateHostCount} linked
        host{view.templateHostCount === 1 ? '' : 's'} get this change.
      </Typography>
    </EditDialog>
  );
}
