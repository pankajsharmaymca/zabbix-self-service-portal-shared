import { Box, ButtonBase, Typography } from '@mui/material';
import { textOn, useSeverities } from '../../live';

/** One-click severity selector: six coloured buttons (3 per row on phones). */
export default function SeverityPicker({ value, onChange, disabled }) {
  const severities = useSeverities();
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Severity</Typography>
      <Box
        role="radiogroup"
        aria-label="Severity"
        sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' }, gap: 1 }}
      >
        {severities.map((s) => {
          const selected = s.value === value;
          return (
            <ButtonBase
              key={s.value}
              role="radio"
              aria-checked={selected}
              aria-label={s.name}
              disabled={disabled}
              onClick={() => onChange(s.value)}
              sx={{
                px: 1, py: 1.25, borderRadius: 2, border: 2, fontSize: 13, fontWeight: 600, lineHeight: 1.2,
                borderColor: selected ? s.color : 'divider',
                bgcolor: selected ? s.color : 'background.paper',
                color: selected ? textOn(s.color) : 'text.secondary',
                boxShadow: selected ? `0 0 0 3px ${s.color}40` : 'none',
                transition: 'all .12s',
                '&:hover': { borderColor: s.color },
                display: 'flex', flexDirection: 'column', gap: 0.5,
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selected ? `${textOn(s.color)}99` : s.color }} />
              {s.name}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
