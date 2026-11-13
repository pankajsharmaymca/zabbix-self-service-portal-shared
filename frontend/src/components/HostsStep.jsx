import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, ButtonBase, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ResourceTable from './ResourceTable';
import ChipList from './ChipList';
import PageHeader from './PageHeader';
import { HostStatusDialog, HostStatusSwitch } from './HostStatus';
import { mono } from '../theme';
import { api } from '../api';
import { HealthBadge, HealthDot } from './Health';
import { usePageTitle, useRefreshOnFocus } from '../live';

const HIDE_ON_PHONE = { display: { xs: 'none', md: 'table-cell' } };

function describeFilter(f, count) {
  const hosts = `${count} host${count === 1 ? '' : 's'}`;
  if (!f.name) return `${hosts} visible to your account`;
  return `${hosts} in "${f.name}"`;
}

export default function HostsStep({
  appFilter, hosts, loading, selected, onSelectedChange, onStatusChanged, onChangeApplication, onOpenHost, notify,
}) {
  const [statusRequest, setStatusRequest] = useState(null);
  usePageTitle(appFilter.name || 'All hosts');
  const [problems, setProblems] = useState(null);         // hostId -> [problem]
  const [problemsError, setProblemsError] = useState('');  // why Zabbix gave no problems
  const [view, setView] = useState('all');        // all | monitored | disabled | problems
  const selectedHosts = hosts.filter((h) => selected.has(h.id));

  // Live health from Zabbix for the listed hosts
  const hostKey = hosts.map((h) => `${h.id}:${h.enabled}`).join(',');
  const loadProblems = useCallback(async () => {
    if (!hosts.length) { setProblems({}); return; }
    try {
      const list = await api.problems(hosts.map((h) => h.id));
      const map = {};
      hosts.forEach((h) => { map[h.id] = []; });
      list.forEach((p) => { (map[p.hostId] ||= []).push(p); });
      setProblems(map);
      setProblemsError('');
    } catch (e) {
      setProblems(null);
      setProblemsError(e.message || 'Zabbix did not answer');
    }
  }, [hostKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadProblems(); }, [loadProblems]);
  useRefreshOnFocus(loadProblems);

  const counts = useMemo(() => ({
    all: hosts.length,
    monitored: hosts.filter((h) => h.enabled).length,
    disabled: hosts.filter((h) => !h.enabled).length,
    problems: problems ? hosts.filter((h) => h.enabled && problems[h.id]?.length).length : null,
  }), [hosts, problems]);

  const visible = useMemo(() => hosts.filter((h) => {
    if (view === 'monitored') return h.enabled;
    if (view === 'disabled') return !h.enabled;
    if (view === 'problems') return h.enabled && problems?.[h.id]?.length;
    return true;
  }), [hosts, view, problems]);

  const worstSeverity = (h) => {
    const p = problems?.[h.id];
    if (!h.enabled) return -2;
    return p?.length ? p[0].severity * 1000 + p.length : -1;
  };

  const columns = [
    {
      key: 'name',
      label: 'Host',
      width: '28%',
      sortValue: (h) => h.name.toLowerCase(),
      render: (h) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{h.name}</Typography>
          {h.host !== h.name && (
            <Typography variant="caption" component="div" sx={{ fontFamily: mono }}>{h.host}</Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'health',
      label: 'Health',
      width: 150,
      cellSx: { whiteSpace: 'nowrap' },
      sortValue: worstSeverity,
      render: (h) => <HealthBadge host={h} problems={problems?.[h.id]} error={problemsError} />,
    },
    {
      key: 'status',
      label: 'Monitoring',
      width: 150,
      cellSx: { whiteSpace: 'nowrap' },
      sortValue: (h) => (h.enabled ? 1 : 0),
      render: (h) => <HostStatusSwitch host={h} onRequest={setStatusRequest} />,
    },
    { key: 'groups', label: 'Host groups', cellSx: HIDE_ON_PHONE, render: (h) => <ChipList items={h.groups} max={2} /> },
    {
      key: 'templates',
      label: 'Templates',
      cellSx: HIDE_ON_PHONE,
      render: (h) => <ChipList items={h.templates.map((t) => t.name)} max={2} empty="None" />,
    },
    {
      key: 'open',
      label: '',
      width: 40,
      cellSx: { pl: 0, color: 'text.disabled' },
      render: (h) => <ChevronRightRoundedIcon aria-label={`Open ${h.name}`} fontSize="small" />,
    },
  ];

  return (
    <Box sx={{ pb: selected.size ? 10 : 0 }}>
      <PageHeader
        crumbs={[{ label: 'Applications', onClick: onChangeApplication }]}
        title={appFilter.name || 'All hosts'}
        subtitle={describeFilter(appFilter, hosts.length)}
        actions={<Button variant="outlined" onClick={onChangeApplication}>Change application</Button>}
      />

      <SummaryStrip counts={counts} value={view} onChange={setView} />

      {loading && hosts.length > 0 && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
      <ResourceTable
        rows={visible}
        loading={loading}
        defaultSort={{ key: 'name', dir: 'asc' }}
        columns={columns}
        selected={selected}
        onSelectedChange={onSelectedChange}
        onRowClick={(h) => onOpenHost(h.id)}
        searchText={(h) => [h.name, h.host, ...h.groups, ...h.templates.map((t) => t.name)].join(' ')}
        searchPlaceholder="Search hosts, groups or templates"
        emptyText={view === 'all' ? 'No hosts found for this application.' : 'No hosts in this view.'}
        noun="host"
      />
      {problemsError && (
        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
          Health is unknown: Zabbix did not answer with the open problems ({problemsError}). The rest of this page
          works as usual; the portal asks again when you come back to this browser tab.
        </Alert>
      )}
      <Typography variant="caption" component="p" sx={{ mt: 1.5 }}>
        Health shows the problems open in Zabbix right now. Open a host to work on its templates.
        Monitoring on/off applies to the host only.
      </Typography>

      {selected.size > 0 && (
        <Paper
          variant="outlined"
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, borderRadius: 0, borderInline: 0, borderBottom: 0,
            px: { xs: 2, md: 4 }, py: 1.5, bgcolor: 'custom.bar', backdropFilter: 'blur(6px)',
            boxShadow: (t) => `0 -8px 24px ${t.palette.custom.shadow}`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ maxWidth: 1400, mx: 'auto' }}>
            <Typography variant="body2" fontWeight={600}>{selected.size} selected</Typography>
            <Stack direction="row" spacing={1}>
              <Button color="inherit" onClick={() => onSelectedChange(new Set())} sx={{ color: 'text.secondary' }}>Clear</Button>
              <Button variant="outlined" color="error" onClick={() => setStatusRequest({ hosts: selectedHosts, enabled: false })}
                sx={{ color: 'error.main', borderColor: 'error.main' }}>
                Disable
              </Button>
              <Button variant="contained" onClick={() => setStatusRequest({ hosts: selectedHosts, enabled: true })}>Enable</Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <HostStatusDialog request={statusRequest} onClose={() => setStatusRequest(null)} onDone={onStatusChanged} notify={notify} />
    </Box>
  );
}

const SEGMENTS = [
  { key: 'all', label: 'All hosts' },
  { key: 'monitored', label: 'Monitored', dot: 'success.main' },
  { key: 'disabled', label: 'Disabled', dot: 'action.disabled' },
  { key: 'problems', label: 'With problems', dot: 'error.main' },
];

/** Counts per state; click one to filter the table. */
function SummaryStrip({ counts, value, onChange }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, overflow: 'hidden' }}>
      {SEGMENTS.map((s, i) => {
        const active = value === s.key;
        return (
          <ButtonBase
            key={s.key}
            onClick={() => onChange(active && s.key !== 'all' ? 'all' : s.key)}
            aria-pressed={active}
            sx={{
              justifyContent: 'flex-start', textAlign: 'left', px: 2.5, py: 1.75,
              borderLeft: { sm: i ? 1 : 0 }, borderTop: { xs: i > 1 ? 1 : 0, sm: 0 }, borderColor: 'divider',
              boxShadow: active ? (t) => `inset 0 -2px 0 ${t.palette.secondary.main}` : 'none',
              bgcolor: active ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' },
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{counts[s.key] ?? '–'}</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                {s.dot && <HealthDot color={s.dot} size={7} />}
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </Stack>
            </Box>
          </ButtonBase>
        );
      })}
    </Paper>
  );
}
