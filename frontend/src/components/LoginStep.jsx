import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Stack, TextField, Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { api } from '../api';
import { usePageTitle, useBrand } from '../live';
import { Logo } from './Header';

const POINTS = [
  'Find the hosts that belong to your application',
  'Switch monitoring on or off for a host',
  'Tune template items, triggers, macros, tags and web checks',
];

export default function LoginStep({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState(null);
  const { title } = useBrand();
  usePageTitle('Sign in');

  useEffect(() => {
    api.serverInfo().then(setServer).catch(() => setServer({ reachable: false }));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onLogin(await api.login(username.trim(), password));
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 0, md: 4 } }}>
      <Paper
        variant="outlined"
        sx={{ width: '100%', maxWidth: 940, borderRadius: 3, overflow: 'hidden', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
      >
        <Box sx={{ bgcolor: 'custom.panel', color: 'custom.panelText', p: 5, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.015em', maxWidth: 340 }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'custom.panelText', opacity: 0.72, fontSize: 15, maxWidth: 360 }}>
              Self-service monitoring for application teams, on top of your Zabbix.
            </Typography>
          </Box>
          <Stack component="ul" spacing={1.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 6 }}>
            {POINTS.map((p) => (
              <Stack key={p} component="li" direction="row" spacing={1.5} alignItems="baseline">
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'custom.panelDot', flexShrink: 0, transform: 'translateY(-2px)' }} />
                <Typography sx={{ fontSize: 14.5, color: 'custom.panelText', opacity: 0.9 }}>{p}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box component="form" onSubmit={submit} noValidate sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={2.5}>
            <Box sx={{ mb: 1, '&:empty': { display: 'none' } }}>
              <Logo height={34} maxWidth={200} iconFallback={false} />
            </Box>
            <Box>
              <Typography variant="h5" component="h1">Sign in</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Use your Zabbix account. Its permissions decide which hosts and templates you can see and change.
              </Typography>
            </Box>

            {server && !server.reachable && (
              <Alert severity="warning">Zabbix is not reachable right now. Try again in a few minutes.</Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}

            <TextField label="Username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!username.trim() || !password || submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ minHeight: 42 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
