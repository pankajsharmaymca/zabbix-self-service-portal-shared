import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import PageHeader from './PageHeader';
import { loadLocal, saveLocal, usePageTitle } from '../live';

const RECENT_KEY = 'zsp.recentApps';
const RECENT_MAX = 6;

/** Recent searches are kept in this browser only. */
function rememberRecent(name) {
  const entry = name.trim();
  const list = loadLocal(RECENT_KEY, []).filter((n) => typeof n === 'string' && n !== entry);
  const next = [entry, ...list].slice(0, RECENT_MAX);
  saveLocal(RECENT_KEY, next);
  return next;
}

export default function ApplicationStep({ initial, loading, onSubmit }) {
  const [name, setName] = useState(initial.name);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => {
    const list = loadLocal(RECENT_KEY, []);
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string').slice(0, RECENT_MAX) : [];
  });
  usePageTitle('Find your application');

  const run = async (value) => {
    setError('');
    try {
      await onSubmit({ name: value });
      if (value.trim()) setRecent(rememberRecent(value));
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    run(name);
  };

  const openRecent = (value) => {
    setName(value);
    run(value);
  };

  const clearRecent = () => {
    saveLocal(RECENT_KEY, []);
    setRecent([]);
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Find your application" subtitle="Look up the hosts that belong to an application." />

      <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 2.5, sm: 3.5 } }} component="form" onSubmit={submit} noValidate>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Application name"
            placeholder="e.g. payments"
            autoFocus
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="Matches the host group, the host name and the application tag. Leave it empty to see every host."
          />

          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchRoundedIcon />}
            >
              {loading ? 'Finding hosts…' : 'Find hosts'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {recent.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <HistoryRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2">Recent applications</Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" color="inherit" onClick={clearRecent} sx={{ color: 'text.secondary' }}>Clear</Button>
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
            {recent.map((value) => (
              <Chip
                key={value}
                label={value}
                variant="outlined"
                disabled={loading}
                onClick={() => openRecent(value)}
                sx={{ bgcolor: 'background.paper', fontWeight: 500 }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
