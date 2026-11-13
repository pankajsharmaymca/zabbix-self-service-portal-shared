import { useState } from 'react';
import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel,
  Switch,
} from '@mui/material';
import { api } from '../api';

/**
 * Asks for confirmation, then enables/disables monitoring (Zabbix host.update).
 * request: { hosts: [{id, name}], enabled } or null
 */
export function HostStatusDialog({ request, onClose, onDone, notify }) {
  const [saving, setSaving] = useState(false);
  if (!request) return null;
  const { hosts, enabled } = request;
  const label = hosts.length === 1 ? hosts[0].name : `${hosts.length} hosts`;

  const confirm = async () => {
    setSaving(true);
    try {
      await api.setHostStatus(hosts.map((h) => h.id), enabled);
      notify(`${label} ${enabled ? 'enabled' : 'disabled'}`);
      onDone(hosts.map((h) => h.id), enabled);
      onClose();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{enabled ? 'Enable' : 'Disable'} monitoring?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {enabled
            ? `Zabbix will start collecting data and raising problems for ${label} again.`
            : `Zabbix will stop collecting data and raising problems for ${label} until it is enabled again.`}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          color={enabled ? 'primary' : 'error'}
          onClick={confirm}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {enabled ? 'Enable' : 'Disable'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Status switch for one host; it only asks, the dialog does the change. */
export function HostStatusSwitch({ host, onRequest, showLabel = true }) {
  return (
    <FormControlLabel
      onClick={(e) => e.stopPropagation()}
      control={
        <Switch
          size="small"
          color="success"
          checked={host.enabled}
          onChange={() => onRequest({ hosts: [host], enabled: !host.enabled })}
          slotProps={{ input: { 'aria-label': `${host.enabled ? 'Disable' : 'Enable'} ${host.name}` } }}
        />
      }
      label={showLabel ? (host.enabled ? 'Enabled' : 'Disabled') : ''}
      sx={{
        m: 0, gap: 0.5,
        '& .MuiFormControlLabel-label': {
          fontSize: 13.5, fontWeight: 500, color: host.enabled ? 'success.main' : 'text.secondary',
        },
      }}
    />
  );
}
