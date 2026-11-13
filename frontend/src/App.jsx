import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Container, CssBaseline, Snackbar, ThemeProvider } from '@mui/material';
import { api, onUnauthorized } from './api';
import { createAppTheme } from './theme';
import branding from './branding';
import {
  BrandContext, DEFAULT_SEVERITIES, SeverityContext, loadLocal, saveLocal, useRefreshOnFocus,
} from './live';
import Header from './components/Header';
import LoginStep from './components/LoginStep';
import ApplicationStep from './components/ApplicationStep';
import HostsStep from './components/HostsStep';
import HostStep from './components/HostStep';

const STEP = { LOGIN: 'login', APPLICATION: 'application', HOSTS: 'hosts', HOST: 'host' };

function initialMode() {
  const saved = loadLocal('zsp.mode', null);
  if (saved === 'light' || saved === 'dark') return saved;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const DEFAULT_BRAND = { title: branding.title, logoUrls: branding.logo ? [branding.logo] : [] };

/**
 * Theme + branding shell. Branding (title, logo, colours) comes from the server
 * configuration (/api/branding) so a new deployment needs no rebuild.
 */
export default function App() {
  const [mode, setMode] = useState(initialMode);
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  useEffect(() => {
    api.branding()
      .then((b) => setBrand({
        title: b.title || branding.title,
        logoUrls: [...(b.logo ? ['/api/branding/logo'] : []), ...(branding.logo ? [branding.logo] : [])],
        primaryColor: b.primaryColor || undefined,
        accentColor: b.accentColor || undefined,
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = brand.title;
  }, [brand.title]);

  const theme = useMemo(
    () => createAppTheme(mode, { primary: brand.primaryColor, accent: brand.accentColor }),
    [mode, brand.primaryColor, brand.accentColor],
  );

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      saveLocal('zsp.mode', next);
      return next;
    });
  }, []);

  return (
    <BrandContext.Provider value={brand}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <Portal mode={mode} onToggleMode={toggleMode} />
      </ThemeProvider>
    </BrandContext.Provider>
  );
}

function Portal({ mode, onToggleMode }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState(STEP.LOGIN);
  const [notice, setNotice] = useState(null);

  const [appFilter, setAppFilter] = useState({ name: '' });
  const [hosts, setHosts] = useState([]);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [openHostId, setOpenHostId] = useState(null);
  const [openTemplateId, setOpenTemplateId] = useState(null);

  const [severities, setSeverities] = useState(DEFAULT_SEVERITIES);

  // --- Browser history -------------------------------------------------------
  // Each page of the portal is a history entry, so Back and Forward move between
  // the application search, the host list and a host instead of leaving the portal.
  const fetchRef = useRef(null);

  /** Show a page and add it to the browser history. */
  const go = useCallback((view, { replace = false } = {}) => {
    const entry = { ...(window.history.state || {}), zsp: view };
    if (replace) window.history.replaceState(entry, '');
    else window.history.pushState(entry, '');
    setStep(view.step);
    if (view.filter) setAppFilter(view.filter);
    setOpenHostId(view.hostId ?? null);
    setOpenTemplateId(view.templateId ?? null);
  }, []);

  /** Show a page the browser moved to (Back, Forward, or a reload). */
  const showView = useCallback((view) => {
    const v = view && view.step ? view : { step: STEP.APPLICATION };
    setStep(v.step);
    if (v.filter) setAppFilter(v.filter);
    setOpenHostId(v.hostId ?? null);
    setOpenTemplateId(v.templateId ?? null);
    if (v.step === STEP.HOSTS && v.filter) fetchRef.current?.(v.filter).catch(() => {});
  }, []);

  useEffect(() => {
    const onPop = (e) => showView(e.state?.zsp);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showView]);
  const notify = useCallback((text, severity = 'success') => setNotice({ text, severity }), []);

  // Severity names/colours as configured in Zabbix
  useEffect(() => {
    if (!session) return;
    api.severities().then(setSeverities).catch(() => setSeverities(DEFAULT_SEVERITIES));
  }, [session]);

  useEffect(() => {
    onUnauthorized((error) => {
      setSession(null);
      go({ step: STEP.LOGIN }, { replace: true });
      setNotice({ severity: 'warning', text: error.message });
    });
    api
      .me()
      .then((info) => {
        setSession(info);
        // Keep the page the user was on when they reload the browser tab
        const saved = window.history.state?.zsp;
        if (saved?.step && saved.step !== STEP.LOGIN) showView(saved);
        else go({ step: STEP.APPLICATION }, { replace: true });
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // already logged out
    }
    setSession(null);
    setHosts([]);
    setSelected(new Set());
    go({ step: STEP.LOGIN }, { replace: true });
  };

  // Zabbix host.get for the application
  const fetchHosts = async (filter) => {
    const text = (filter.name || '').trim();
    const params = text ? { mode: 'app', q: text } : { mode: 'all' };
    setLoadingHosts(true);
    try {
      const result = await api.hosts(params);
      setHosts(result);
      return result;
    } finally {
      setLoadingHosts(false);
    }
  };

  fetchRef.current = fetchHosts;

  const handleApplicationSubmit = async (filter) => {
    setAppFilter(filter);
    await fetchHosts(filter);
    setSelected(new Set());
    go({ step: STEP.HOSTS, filter });
  };

  // Pick up hosts added/changed in Zabbix when the user comes back to the tab
  useRefreshOnFocus(() => {
    if (step === STEP.HOSTS) fetchHosts(appFilter).catch(() => {});
  });

  const updateHostStatus = (ids, enabled) => {
    setHosts((prev) => prev.map((h) => (ids.includes(h.id) ? { ...h, enabled } : h)));
  };

  if (checkingSession) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <SeverityContext.Provider value={severities}>
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header session={session} onLogout={handleLogout} mode={mode} onToggleMode={onToggleMode} />

      <Container maxWidth={false} sx={{ maxWidth: 1400, px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, flex: 1 }}>
        {step === STEP.LOGIN && (
          <LoginStep
            onLogin={(info) => {
              setSession(info);
              go({ step: STEP.APPLICATION }, { replace: true });
            }}
          />
        )}

        {step === STEP.APPLICATION && (
          <ApplicationStep initial={appFilter} loading={loadingHosts} onSubmit={handleApplicationSubmit} />
        )}

        {step === STEP.HOSTS && (
          <HostsStep
            appFilter={appFilter}
            hosts={hosts}
            loading={loadingHosts}
            selected={selected}
            onSelectedChange={setSelected}
            onStatusChanged={updateHostStatus}
            onChangeApplication={() => go({ step: STEP.APPLICATION, filter: appFilter })}
            onOpenHost={(id) => go({ step: STEP.HOST, filter: appFilter, hostId: id })}
            notify={notify}
          />
        )}

        {step === STEP.HOST && (
          <HostStep
            hostId={openHostId}
            appLabel={appFilter.name || 'All hosts'}
            onApplications={() => go({ step: STEP.APPLICATION, filter: appFilter })}
            onBack={() => {
              go({ step: STEP.HOSTS, filter: appFilter });
              fetchHosts(appFilter).catch((e) => notify(e.message, 'error'));
            }}
            openTemplateId={openTemplateId}
            onOpenTemplate={(templateId) => go({ step: STEP.HOST, filter: appFilter, hostId: openHostId, templateId })}
            onCloseTemplate={() => {
              // Closing the window undoes the history entry that opening it added,
              // so Back afterwards does not open it again.
              if (window.history.state?.zsp?.templateId) window.history.back();
              else go({ step: STEP.HOST, filter: appFilter, hostId: openHostId });
            }}
            notify={notify}
          />
        )}
      </Container>

      {notice && (
        <Snackbar
          open
          autoHideDuration={5000}
          onClose={() => setNotice(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        </Snackbar>
      )}
    </Box>
    </SeverityContext.Provider>
  );
}
