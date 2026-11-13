import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

/**
 * Page title with a breadcrumb trail above it and optional actions on the right.
 * crumbs: [{ label, onClick }] (the current page is not included)
 */
export default function PageHeader({ crumbs = [], title, subtitle, actions, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      {crumbs.length > 0 && (
        <Breadcrumbs
          separator={<ChevronRightRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
          sx={{ mb: 1, '& .MuiBreadcrumbs-li': { fontSize: 13.5 } }}
          aria-label="Breadcrumb"
        >
          {crumbs.map((c) => (
            <Link key={c.label} component="button" type="button" onClick={c.onClick} sx={{ fontSize: 13.5 }}>
              {c.label}
            </Link>
          ))}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ wordBreak: 'break-word' }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>
          )}
          {children}
        </Box>
        {actions && <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
