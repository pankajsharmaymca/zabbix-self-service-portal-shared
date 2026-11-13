import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { api } from '../../api';
import { CardList, ScopeNote } from './common';

/** Macros: values are saved on the template (every linked host). */
export default function MacrosPanel({ view, hostId, reload, notify, compact, confirmTemplate }) {
  if (view.macros.length === 0) {
    return <Typography color="text.secondary">This template has no macros.</Typography>;
  }
  const rows = view.macros.map((m) => (
    <MacroRow key={m.macro} macro={m} view={view} hostId={hostId} reload={reload} notify={notify}
      compact={compact} confirmTemplate={confirmTemplate} />
  ));
  return (
    <Stack spacing={2}>
      <ScopeNote template>
        Macro values are saved on the template <b>{view.template.name}</b>, so they apply to all{' '}
        {view.templateHostCount} host{view.templateHostCount === 1 ? '' : 's'} linked to it.
      </ScopeNote>
      {compact ? (
        <CardList>{rows}</CardList>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '38%' }}>Macro</TableCell>
                <TableCell>Value on template</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>{rows}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

function MacroRow({ macro, view, hostId, reload, notify, compact, confirmTemplate }) {
  const secret = macro.type === 'secret';
  const [value, setValue] = useState(secret ? '' : macro.value ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only reset when the saved value changed (not on every refresh), so typing isn't lost.
  useEffect(() => {
    setValue(secret ? '' : macro.value ?? '');
  }, [macro.value, secret]);

  const changed = secret ? value !== '' : value !== (macro.value ?? '');

  const run = async (fn, message) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      notify(message);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!(await confirmTemplate(`Changing ${macro.macro}`, [{
      label: macro.macro,
      from: secret ? '•••••• (secret)' : macro.value ?? '',
      to: secret ? 'new secret value' : value,
    }]))) return;
    await run(() => api.setTemplateMacro(hostId, view.template.id, macro.macro, value), `${macro.macro} saved on template`);
  };

  const name = (
    <>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {secret && <LockRoundedIcon sx={{ fontSize: 16 }} color="action" />}
        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: '"IBM Plex Mono", monospace', wordBreak: 'break-all' }}>{macro.macro}</Typography>
      </Stack>
      {macro.description && <Typography variant="caption" color="text.secondary">{macro.description}</Typography>}
    </>
  );

  const override = macro.hostOverride && (
    <Alert
      severity="info"
      sx={{ mt: 1, py: 0, '& .MuiAlert-message': { py: 0.75 } }}
      action={
        <Button size="small" disabled={busy} sx={{ whiteSpace: 'nowrap' }} onClick={() => run(() => api.resetMacro(hostId, macro.hostMacroId), `${view.host.name} now uses the template value of ${macro.macro}`)}>
          Use template value
        </Button>
      }
    >
      {view.host.name} has its own value{macro.hostValue != null ? <> (<b>{macro.hostValue}</b>)</> : ''}, which takes precedence on this host.
    </Alert>
  );

  const editor = (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <TextField
        value={value}
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        placeholder={secret ? 'Secret – type a new value' : ''}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        error={Boolean(error)}
        helperText={error || undefined}
        slotProps={{ htmlInput: { 'aria-label': `Value of ${macro.macro}` } }}
      />
      <Button variant="contained" disabled={!changed || busy} onClick={save} sx={{ mt: 0.25, flexShrink: 0 }}>Save</Button>
    </Stack>
  );

  if (compact) {
    return (
      <Box sx={{ p: 1.75 }} role="row">
        {name}
        <Box sx={{ mt: 1.25 }}>{editor}</Box>
        {override}
      </Box>
    );
  }
  return (
    <TableRow>
      <TableCell sx={{ verticalAlign: 'top', pt: 2 }}>{name}</TableCell>
      <TableCell sx={{ verticalAlign: 'top' }} colSpan={2}>
        {editor}
        {override}
      </TableCell>
    </TableRow>
  );
}
