import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { api } from '../api';
import ChipList from './ChipList';
import PageHeader from './PageHeader';
import { HostStatusDialog, HostStatusSwitch } from './HostStatus';
import TemplateEditor from './TemplateEditor';
import { usePageTitle, useRefreshOnFocus } from '../live';
import { mono } from '../theme';
import { useSeverities } from '../live';
import { HealthDot, since } from './Health';
import { SeverityChip } from './editor/common';

// Counts that are useful but not essential on a phone screen
const COUNT_COL = { width: 92, display: { xs: 'none', sm: 'table-cell' } };

/** One host: monitoring status, and the templates linked to it. */
export default function HostStep({
  hostId, appLabel, onBack, onApplications, openTemplateId, onOpenTemplate, onCloseTemplate, notify,
}) {
  const [host, setHost] = useState(null);
  const [error, setError] = useState('');
  const [statusRequest, setStatusRequest] = useState(null);
  const [problems, setProblems] = useState(null);
  const [problemsError, setProblemsError] = useState('');
  const [summary, setSummary] = useState(null);
  usePageTitle(host?.name);

  const openTemplate = host?.templates.find((t) => t.id === openTemplateId) || null;

  const load = useCallback(async () => {
    try {
      const [h] = await api.hosts({ mode: 'ids', ids: [hostId] });
      if (!h) throw new Error('Host not found, or your account has no access to it.');
      setHost(h);
      const [p, sum] = await Promise.all([
        api.problems([hostId]).then((r) => { setProblemsError(''); return r; })
          .catch((e) => { setProblemsError(e.message || 'Zabbix did not answer'); return null; }),
        api.templateSummary(hostId).catch(() => null),
      ]);
      setProblems(p);
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    }
  }, [hostId]);

  const counts = (id) => summary?.find((x) => x.id === id);

  useEffect(() => {
    load();
  }, [load]);

  // Counts and problems change while a template is open, so read them again on close
  useEffect(() => {
    if (!openTemplateId) load();
  }, [openTemplateId, load]);

  // Templates linked/unlinked in Zabbix show up when the user comes back (the editor refreshes itself)
  useRefreshOnFocus(() => {
    if (!openTemplate) load();
  });

  return (
    <Box>
      <PageHeader
        crumbs={[{ label: 'Applications', onClick: onApplications }, { label: appLabel, onClick: onBack }]}
        title={host ? host.name : <Skeleton width={260} />}
        actions={host && (
          <Paper variant="outlined" sx={{ px: 1.75, py: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">Monitoring</Typography>
            <HostStatusSwitch host={host} onRequest={setStatusRequest} />
          </Paper>
        )}
      >
        {host && (
          <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {host.host !== host.name && (
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: mono }}>{host.host}</Typography>
            )}
            <ChipList items={host.groups} max={4} />
          </Stack>
        )}
      </PageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {host && <ProblemsPanel host={host} problems={problems} error={problemsError} />}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" component="h2">Linked templates</Typography>
          <Typography variant="caption">Open a template to view and change its items, triggers, macros, tags and web checks.</Typography>
        </Box>
        {!host ? (
          <Box sx={{ p: 2 }}><Skeleton height={44} /><Skeleton height={44} /></Box>
        ) : host.templates.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">No templates are linked to this host.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Template</TableCell>
                <TableCell align="right" sx={{ width: 92 }}>Items</TableCell>
                <TableCell align="right" sx={{ width: 92 }}>Triggers</TableCell>
                <TableCell align="right" sx={COUNT_COL}>Macros</TableCell>
                <TableCell align="right" sx={COUNT_COL}>Tags</TableCell>
                <TableCell align="right" sx={COUNT_COL}>Web checks</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {host.templates.map((t) => (
                <TableRow
                  key={t.id}
                  hover
                  role="button"
                  tabIndex={0}
                  aria-label={t.name}
                  onClick={() => onOpenTemplate(t.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenTemplate(t.id); }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ py: 1.5 }}><Typography variant="body2" fontWeight={600}>{t.name}</Typography></TableCell>
                  <TableCell align="right">{counts(t.id)?.items ?? <Skeleton width={20} sx={{ ml: 'auto' }} />}</TableCell>
                  <TableCell align="right">{counts(t.id)?.triggers ?? <Skeleton width={20} sx={{ ml: 'auto' }} />}</TableCell>
                  <TableCell align="right" sx={COUNT_COL}>{counts(t.id)?.macros ?? <Skeleton width={20} sx={{ ml: 'auto' }} />}</TableCell>
                  <TableCell align="right" sx={COUNT_COL}>{counts(t.id)?.tags ?? <Skeleton width={20} sx={{ ml: 'auto' }} />}</TableCell>
                  <TableCell align="right" sx={COUNT_COL}>{counts(t.id)?.web ?? <Skeleton width={20} sx={{ ml: 'auto' }} />}</TableCell>
                  <TableCell sx={{ color: 'text.disabled', pl: 0 }}><ChevronRightRoundedIcon fontSize="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <HostStatusDialog
        request={statusRequest}
        onClose={() => setStatusRequest(null)}
        onDone={(_, enabled) => setHost((h) => ({ ...h, enabled }))}
        notify={notify}
      />

      {openTemplate && host && (
        <TemplateEditor
          host={host}
          template={openTemplate}
          onClose={onCloseTemplate}
          notify={notify}
        />
      )}
    </Box>
  );
}

/** Current problems on the host, live from Zabbix (most severe first). */
/** How many problems are listed before "Show all". A busy host can have dozens. */
const PROBLEMS_SHOWN = 8;

function ProblemsPanel({ host, problems, error }) {
  const severities = useSeverities();
  const [showAll, setShowAll] = useState(false);

  if (!host.enabled) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>Monitoring is switched off for this host, so Zabbix raises no problems for it.</Alert>
    );
  }
  if (error) {
    return (
      <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
        Open problems are unknown: Zabbix did not answer ({error}). Everything else on this page works.
      </Alert>
    );
  }
  if (!problems) return null;

  // One chip per severity in use, worst first: the shape of the trouble at a glance
  const bySeverity = [];
  problems.forEach((p) => {
    const found = bySeverity.find((b) => b.severity === p.severity);
    if (found) found.count += 1;
    else bySeverity.push({ severity: p.severity, count: 1 });
  });
  bySeverity.sort((a, b) => b.severity - a.severity);

  const shown = showAll ? problems : problems.slice(0, PROBLEMS_SHOWN);
  const hidden = problems.length - shown.length;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap"
        sx={{ px: 2.5, py: 1.5, borderBottom: problems.length ? 1 : 0, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <HealthDot color={problems.length ? (severities[problems[0].severity] || severities[0]).color : 'success.main'} size={10} />
          <Typography variant="h6" component="h2">
            {problems.length ? `${problems.length} open problem${problems.length === 1 ? '' : 's'}` : 'No open problems'}
          </Typography>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {bySeverity.length > 1 && bySeverity.map((b) => (
            <SeverityChip key={b.severity} severity={b.severity} count={b.count} />
          ))}
        </Stack>
      </Stack>
      {problems.length > 0 && (
        <>
          <Table size="small">
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.triggerId}>
                  <TableCell sx={{ width: 130 }}><SeverityChip severity={p.severity} /></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{p.name}</Typography></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{since(p.since)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(hidden > 0 || showAll) && (
            <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
              <Button size="small" onClick={() => setShowAll(!showAll)}>
                {showAll ? `Show the ${PROBLEMS_SHOWN} worst only` : `Show all ${problems.length} problems`}
              </Button>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
