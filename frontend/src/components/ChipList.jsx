import { Chip, Stack, Tooltip, Typography } from '@mui/material';

/** Shows up to `max` chips and a "+N" chip with the rest in a tooltip. */
export default function ChipList({ items, max = 3, color = 'default', variant = 'outlined', empty = '—' }) {
  if (!items || items.length === 0) {
    return <Typography variant="body2" color="text.disabled">{empty}</Typography>;
  }
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {shown.map((label) => (
        <Chip key={label} label={label} size="small" color={color} variant={variant}
          sx={color === 'default' ? { bgcolor: 'custom.chip', border: 0, color: 'text.secondary' } : undefined} />
      ))}
      {rest.length > 0 && (
        <Tooltip title={rest.join(', ')}>
          <Chip label={`+${rest.length}`} size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
        </Tooltip>
      )}
    </Stack>
  );
}
