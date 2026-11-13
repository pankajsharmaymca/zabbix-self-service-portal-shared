import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useSeverities } from '../live';

export function HealthDot({ color, size = 9 }) {
  return <Box component="span" sx={{ width: size, height: size, borderRadius: '50%', bgcolor: color, display: 'inline-block', flexShrink: 0 }} />;
}

/**
 * Live health of a host from Zabbix: OK, n problems (coloured by the worst severity), or not monitored.
 * problems: [{ name, severity, since }] for this host, most severe first.
 */
export function HealthBadge({ host, problems, error }) {
  const severities = useSeverities();
  if (!host.enabled) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <HealthDot color="action.disabled" />
        <Typography variant="body2" color="text.disabled">Not monitored</Typography>
      </Stack>
    );
  }
  if (error) {
    return (
      <Tooltip title={`Zabbix did not answer with the open problems: ${error}`}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'help' }} onClick={(e) => e.stopPropagation()}>
          <HealthDot color="warning.main" />
          <Typography variant="body2" color="text.secondary">Unknown</Typography>
        </Stack>
      </Tooltip>
    );
  }
  if (!problems) {
    return <Typography variant="body2" color="text.disabled">…</Typography>;
  }
  if (problems.length === 0) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <HealthDot color="success.main" />
        <Typography variant="body2" color="text.secondary">OK</Typography>
      </Stack>
    );
  }
  const worst = severities[problems[0].severity] || severities[0];
  const tip = (
    <Box sx={{ py: 0.5 }}>
      {problems.slice(0, 6).map((p, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <HealthDot color={(severities[p.severity] || severities[0]).color} size={7} />
          <span>{p.name}</span>
        </Stack>
      ))}
      {problems.length > 6 && <div>and {problems.length - 6} more</div>}
    </Box>
  );
  return (
    <Tooltip title={tip}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
        <HealthDot color={worst.color} />
        <Typography variant="body2" fontWeight={600}>
          {problems.length} problem{problems.length === 1 ? '' : 's'}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

/** "3 hours ago" style age for a Unix timestamp. */
export function since(epochSeconds) {
  if (!epochSeconds) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
