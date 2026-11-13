import { useCallback, useRef, useState } from 'react';
import { textOn, useSeverities } from '../../live';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Stack, Switch, Typography,
} from '@mui/material';

export function SeverityChip({ severity, count }) {
  const severities = useSeverities();
  const s = severities[severity] || severities[0];
  const label = count === undefined ? s.name : `${s.name} ${count}`;
  return <Chip size="small" label={label} sx={{ bgcolor: s.color, color: textOn(s.color), fontWeight: 600 }} />;
}

export function StatusChip({ enabled }) {
  return (
    <Chip
      size="small"
      label={enabled ? 'Enabled' : 'Disabled'}
      variant={enabled ? 'filled' : 'outlined'}
      sx={enabled ? { bgcolor: 'custom.okTint', color: 'success.main', fontWeight: 600 } : { color: 'text.secondary' }}
    />
  );
}

/** Shown when this host's own copy differs from the template (e.g. switched off directly in Zabbix). */
export function HostDiffNote({ enabled, hostEnabled, hostName }) {
  if (enabled === hostEnabled) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      color="warning"
      label={hostEnabled ? `On for ${hostName}` : `Off for ${hostName}`}
      title={`Changed directly on ${hostName} in Zabbix; it differs from the template.`}
      sx={{ ml: 0.5 }}
    />
  );
}

/** One-line note that says where changes in this section are saved. */
export function ScopeNote({ template, children }) {
  return (
    <Box
      sx={{
        borderLeft: 3, borderColor: template ? 'warning.main' : 'secondary.main', bgcolor: template ? 'custom.scopeTemplate' : 'custom.scopeHost',
        color: template ? 'custom.scopeTemplateText' : 'custom.scopeHostText', borderRadius: '0 6px 6px 0', px: 1.75, py: 1, fontSize: 13.5, lineHeight: 1.5,
      }}
    >
      {children}
    </Box>
  );
}

/** Enable/disable switch; onToggle does the (confirmed) save. */
export function HostSwitch({ checked, disabled, label, onToggle }) {
  const [busy, setBusy] = useState(false);
  return (
    <FormControlLabel
      onClick={(e) => e.stopPropagation()}
      control={
        <Switch
          size="small"
          color="success"
          checked={checked}
          disabled={disabled || busy}
          onChange={async () => {
            setBusy(true);
            try {
              await onToggle(!checked);
            } finally {
              setBusy(false);
            }
          }}
          slotProps={{ input: { 'aria-label': label } }}
        />
      }
      label={checked ? 'Enabled' : 'Disabled'}
      sx={{
        m: 0, gap: 0.5, whiteSpace: 'nowrap',
        '& .MuiFormControlLabel-label': { fontSize: 13.5, fontWeight: 500, color: checked ? 'success.main' : 'text.secondary' },
      }}
    />
  );
}

/** "a: b, c" text for a tag list, for before/after summaries. */
export const tagsText = (tags) => (tags.length ? tags.map((t) => (t.value ? `${t.tag}: ${t.value}` : t.tag)).join(', ') : 'none');
export const statusText = (enabled) => (enabled ? 'Enabled' : 'Disabled');

/** Before → after rows. changes: [{ label, from, to }] */
function ChangeList({ changes }) {
  const shown = changes.slice(0, 8);
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
      {shown.map((c, i) => (
        <Box key={i} sx={{ px: 1.5, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 600, color: 'text.secondary', wordBreak: 'break-word' }}>
            {c.label}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="baseline" useFlexGap flexWrap="wrap" sx={{ fontSize: 13.5 }}>
            <Box component="span" sx={{ color: 'text.secondary', textDecoration: 'line-through', wordBreak: 'break-word' }}>
              {c.from === '' || c.from == null ? '(empty)' : c.from}
            </Box>
            <Box component="span" aria-hidden sx={{ color: 'text.disabled' }}>→</Box>
            <Box component="span" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {c.to === '' || c.to == null ? '(empty)' : c.to}
            </Box>
          </Stack>
        </Box>
      ))}
      {changes.length > shown.length && (
        <Typography variant="caption" component="div" sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
          and {changes.length - shown.length} more
        </Typography>
      )}
    </Box>
  );
}

/**
 * Confirmation before a change that is saved on the template (and so reaches every linked host).
 * Returns [confirm(action, changes) => Promise<boolean>, dialogElement]; changes: [{ label, from, to }].
 */
export function useTemplateConfirm(templateName, hostCount) {
  const [pending, setPending] = useState(null);
  const [dontAsk, setDontAsk] = useState(false);
  const skip = useRef(false);

  const confirm = useCallback((action, changes = []) => {
    if (skip.current) return Promise.resolve(true);
    return new Promise((resolve) => setPending({ action, changes, resolve }));
  }, []);

  const close = (ok) => {
    if (ok && dontAsk) skip.current = true;
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = (
    <Dialog open={Boolean(pending)} onClose={() => close(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Save on the template?</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            {pending?.action} changes the template <b>{templateName}</b>.
          </Typography>
          {pending?.changes?.length > 0 && <ChangeList changes={pending.changes} />}
          <Alert severity="warning">
            It is linked to <b>{hostCount} host{hostCount === 1 ? '' : 's'}</b>. All of them get {pending?.changes?.length > 1 ? 'these changes' : 'this change'}.
          </Alert>
          <FormControlLabel
            control={<Checkbox size="small" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />}
            label={<Typography variant="body2">Don't ask again while this template is open</Typography>}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => close(false)}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={() => close(true)}>Save on template</Button>
      </DialogActions>
    </Dialog>
  );

  return [confirm, dialog];
}

/** Standard edit dialog shell with Save / Cancel. */
export function EditDialog({ title, subtitle, error, saving, canSave, onSave, onClose, saveLabel = 'Save', children }) {
  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
        {subtitle && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>
            {subtitle}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={!canSave || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Bordered list used for the phone layout of each tab. */
export function CardList({ children }) {
  return (
    <Stack
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}
      divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}
    >
      {children}
    </Stack>
  );
}
