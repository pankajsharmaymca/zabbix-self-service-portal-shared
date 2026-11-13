import { useMemo, useState } from 'react';
import {
  Box, FormControlLabel, IconButton, InputAdornment, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { api } from '../../api';
import ChipList from '../ChipList';
import TagEditor, { cleanTags, sameTags, tagLabels, tagsValid } from '../TagEditor';
import { CardList, EditDialog, HostDiffNote, ScopeNote, StatusChip, statusText, tagsText } from './common';

/** Items: the host's copies of the template's items. Saved on this host only. */
export default function ItemsPanel({ view, hostId, reload, openFresh, notify, compact, confirmTemplate }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? view.items.filter((i) => `${i.name} ${i.key} ${tagLabels(i.tags).join(' ')}`.toLowerCase().includes(term))
      : view.items;
  }, [view.items, search]);

  const openItem = (i) => openFresh((v) => v.items.find((x) => x.id === i.id), setEditing);

  if (view.items.length === 0) {
    return <Typography color="text.secondary">This template has no items on this host.</Typography>;
  }

  const schedule = (i) =>
    [i.supportsInterval && `Interval ${i.delay}`, `History ${i.history}`, i.supportsTrends && `Trends ${i.trends}`]
      .filter(Boolean).join(' · ');

  return (
    <Stack spacing={2}>
      <ScopeNote template>
        Item changes, including enable/disable, are saved on the template <b>{view.template.name}</b> (all{' '}
        {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'}).
      </ScopeNote>
      <TextField
        placeholder="Search items"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ maxWidth: 360 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
      />
      {compact ? (
        <CardList>
          {items.map((i) => (
            <Box key={i.id} role="button" tabIndex={0} onClick={() => openItem(i)} sx={{ p: 1.75, cursor: 'pointer' }}>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{i.name}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>{i.key}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <StatusChip enabled={i.enabled} />
                  <HostDiffNote enabled={i.enabled} hostEnabled={i.hostEnabled} hostName={view.host.name} />
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>{schedule(i)}</Typography>
              {i.tags.length > 0 && <Box sx={{ mt: 0.75 }}><ChipList items={tagLabels(i.tags)} max={3} /></Box>}
            </Box>
          ))}
        </CardList>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Interval</TableCell>
                <TableCell>History</TableCell>
                <TableCell>Trends</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tags</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} hover sx={{ cursor: 'pointer' }} onClick={() => openItem(i)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{i.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>{i.key}</Typography>
                  </TableCell>
                  <TableCell>{i.supportsInterval ? i.delay : '—'}</TableCell>
                  <TableCell>{i.history}</TableCell>
                  <TableCell>{i.supportsTrends ? i.trends : '—'}</TableCell>
                  <TableCell>
                    <StatusChip enabled={i.enabled} />
                    <HostDiffNote enabled={i.enabled} hostEnabled={i.hostEnabled} hostName={view.host.name} />
                  </TableCell>
                  <TableCell><ChipList items={tagLabels(i.tags)} max={2} /></TableCell>
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={`Edit ${i.name}`}><EditRoundedIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {editing && (
        <ItemEditDialog
          item={editing}
          view={view}
          confirmTemplate={confirmTemplate}
          hostId={hostId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            notify('Item saved on template');
            await reload();
          }}
        />
      )}
    </Stack>
  );
}

function ItemEditDialog({ item, view, confirmTemplate, hostId, onClose, onSaved }) {
  const [form, setForm] = useState({
    delay: item.delay,
    history: item.history,
    trends: item.trends,
    enabled: item.enabled,
    description: item.description,
    tags: item.tags.map((t) => ({ ...t })),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const valid = tagsValid(form.tags)
    && (!item.supportsInterval || form.delay.trim())
    && form.history.trim()
    && (!item.supportsTrends || form.trends.trim());

  const save = async () => {
    const changes = [];
    if (item.supportsInterval && form.delay.trim() !== item.delay) changes.push({ label: 'Update interval', from: item.delay, to: form.delay.trim() });
    if (form.history.trim() !== item.history) changes.push({ label: 'History', from: item.history, to: form.history.trim() });
    if (item.supportsTrends && form.trends.trim() !== item.trends) changes.push({ label: 'Trends', from: item.trends, to: form.trends.trim() });
    if (form.enabled !== item.enabled) changes.push({ label: 'Status', from: statusText(item.enabled), to: statusText(form.enabled) });
    if (form.description !== item.description) changes.push({ label: 'Description', from: item.description, to: form.description });
    if (!sameTags(form.tags, item.tags)) changes.push({ label: 'Tags', from: tagsText(item.tags), to: tagsText(cleanTags(form.tags)) });
    if (!changes.length) { onClose(); return; }
    if (!(await confirmTemplate(`Changing the item "${item.name}"`, changes))) return;
    setSaving(true);
    setError('');
    const change = { history: form.history.trim(), enabled: form.enabled, description: form.description, tags: cleanTags(form.tags) };
    if (item.supportsInterval) change.delay = form.delay.trim();
    if (item.supportsTrends) change.trends = form.trends.trim();
    try {
      await api.updateItem(hostId, view.template.id, item.id, change);
      await onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <EditDialog title={item.name} subtitle={item.key} error={error} saving={saving} canSave={valid} onSave={save} onClose={onClose} saveLabel="Save on template">
      <FormControlLabel
        control={<Switch color="success" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />}
        label={form.enabled ? 'Enabled' : 'Disabled'}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {item.supportsInterval && <TextField label="Update interval" value={form.delay} onChange={set('delay')} helperText="e.g. 30s, 1m, 1h" />}
        <TextField label="History" value={form.history} onChange={set('history')} helperText="e.g. 7d, 31d" />
        {item.supportsTrends && <TextField label="Trends" value={form.trends} onChange={set('trends')} helperText="e.g. 365d, 0" />}
      </Stack>
      <TextField label="Description" value={form.description} onChange={set('description')} multiline minRows={2} />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Item tags</Typography>
        <TagEditor tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} disabled={saving} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        Saved on the template {view.template.name}: all {view.templateHostCount} linked host{view.templateHostCount === 1 ? '' : 's'} get this change.
      </Typography>
    </EditDialog>
  );
}
