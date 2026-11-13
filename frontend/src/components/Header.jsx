import { useEffect, useState } from 'react';
import {
  AppBar, Avatar, Box, Button, Divider, IconButton, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import branding from '../branding';
import { useBrand } from '../live';

/**
 * The organisation's logo. Tries each configured source in turn (server logo
 * from PORTAL_LOGO_FILE, then the logo built into the frontend) and falls back
 * to the portal icon when none loads.
 */
export function Logo({ height = 26, maxWidth = 150, iconFallback = true }) {
  const { logoUrls = [] } = useBrand();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [logoUrls.join('|')]);

  if (index >= logoUrls.length) {
    if (!iconFallback) return null;
    return (
      <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: height + 4, height: height + 4 }}>
        <HubRoundedIcon sx={{ fontSize: Math.round(height * 0.66) }} />
      </Avatar>
    );
  }
  return (
    <Box
      component="img"
      src={logoUrls[index]}
      alt={branding.logoAlt || 'Logo'}
      onError={() => setIndex((i) => i + 1)}
      sx={{ height, width: 'auto', maxWidth, display: 'block' }}
    />
  );
}

export default function Header({ session, onLogout, mode, onToggleMode }) {
  const { title } = useBrand();
  const dark = mode === 'dark';
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 2, minHeight: { xs: 56, sm: 60 }, px: { xs: 2, md: 4 } }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <Logo height={branding.logoHeight - 6} />
          <Divider orientation="vertical" flexItem sx={{ my: 2, display: { xs: 'none', sm: 'block' } }} />
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary', display: { xs: 'none', sm: 'block' } }}>
            {title}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
            <IconButton size="small" onClick={onToggleMode} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              sx={{ color: 'text.secondary' }}>
              {dark ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {session && (
            <>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 13, fontWeight: 600, bgcolor: 'custom.ownTag', color: 'secondary.main' }}>
                  {session.username.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="body2" fontWeight={500}>{session.username}</Typography>
              </Stack>
              <Button size="small" color="inherit" startIcon={<LogoutRoundedIcon fontSize="small" />} onClick={onLogout}
                sx={{ color: 'text.secondary' }}>
                Sign out
              </Button>
            </>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
