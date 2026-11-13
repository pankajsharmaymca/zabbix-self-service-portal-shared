import { alpha, createTheme, darken, lighten } from '@mui/material/styles';

export const mono = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const sans = '"IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif';

/**
 * Design tokens for an operations console, light and dark.
 * Borders instead of shadows; shadows only on things that float.
 * brand.primary / brand.accent (from the portal configuration) override the defaults.
 */
function tokensFor(mode, brand = {}) {
  const light = {
    ink: '#16294A', inkSoft: '#3B4A63', muted: '#66758C', disabled: '#9AA6B6',
    canvas: '#F4F6F9', surface: '#FFFFFF', surfaceAlt: '#F8FAFC', line: '#DDE3EB', lineSoft: '#EDF1F5', inputLine: '#CDD5E0',
    signal: '#0B7A85', signalTint: '#E6F3F4', signalText: '#08575F',
    amber: '#A15C07', amberTint: '#FFF6E5', amberText: '#6E3F05',
    ok: '#1E7B4C', okTint: '#E5F4EC', danger: '#B42318',
    chip: '#EEF2F6', toggleSelected: '#E9EEF5', panel: '#16294A', panelText: '#FFFFFF', panelDot: '#5FC4CC',
    primaryBg: '#16294A', primaryText: '#FFFFFF',
    shadow: 'rgba(15,28,53,.16)', backdrop: 'rgba(16,28,48,.38)', bar: 'rgba(255,255,255,0.97)',
  };
  const dark = {
    ink: '#E6EBF2', inkSoft: '#B3BECD', muted: '#8693A7', disabled: '#5D6B80',
    canvas: '#0E141D', surface: '#151D29', surfaceAlt: '#18212E', line: '#283445', lineSoft: '#212B39', inputLine: '#36445A',
    signal: '#45B8C2', signalTint: '#14303A', signalText: '#9BDCE2',
    amber: '#F0AE4B', amberTint: '#2A2112', amberText: '#F6D29B',
    ok: '#4CC38A', okTint: '#13291F', danger: '#F2796C',
    chip: '#222C3A', toggleSelected: '#26324A', panel: '#18233A', panelText: '#E6EBF2', panelDot: '#45B8C2',
    primaryBg: '#D7E0EE', primaryText: '#0E1C35',
    shadow: 'rgba(0,0,0,.5)', backdrop: 'rgba(3,7,13,.6)', bar: 'rgba(21,29,41,0.97)',
  };
  const t = mode === 'dark' ? dark : light;
  // Brand colours from the portal configuration. Body text keeps its neutral ink so
  // any brand colour stays readable; the brand shows on buttons, the sign-in panel
  // and highlights.
  if (brand.primary && mode !== 'dark') {
    t.primaryBg = brand.primary;
    t.primaryText = readableOn(brand.primary);
    t.panel = brand.primary;
    t.panelText = readableOn(brand.primary);
  }
  if (brand.accent) {
    t.signal = brand.accent;
    t.panelDot = brand.accent;
    t.signalTint = alpha(brand.accent, mode === 'dark' ? 0.18 : 0.1);
    t.signalText = mode === 'dark' ? lighten(brand.accent, 0.5) : darken(brand.accent, 0.35);
  }
  return t;
}

/** Black or white, whichever reads better on the given hex colour. */
function readableOn(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // compare contrast ratios against white and the dark ink (#0E1C35, luminance ~0.012)
  return (lum + 0.05) / 0.062 > 1.05 / (lum + 0.05) ? '#0E1C35' : '#FFFFFF';
}

export function createAppTheme(mode = 'light', brand = {}) {
  const k = tokensFor(mode, brand);
  return createTheme({
    palette: {
      mode,
      primary: { main: k.primaryBg, contrastText: k.primaryText },
      secondary: { main: k.signal, contrastText: readableOn(k.signal) },
      success: { main: k.ok, light: k.okTint },
      warning: { main: k.amber, light: k.amberTint },
      error: { main: k.danger },
      info: { main: k.signal },
      background: { default: k.canvas, paper: k.surface },
      text: { primary: k.ink, secondary: k.inkSoft, disabled: k.disabled },
      divider: k.line,
      action: { hover: alpha(k.ink, 0.04), selected: alpha(k.signal, mode === 'dark' ? 0.16 : 0.08) },
      // Named colours used by the components (so light/dark both work)
      custom: {
        chip: k.chip, ownTag: k.signalTint, ownTagText: k.signalText, okTint: k.okTint,
        scopeTemplate: k.amberTint, scopeTemplateText: k.amberText, scopeHost: k.signalTint, scopeHostText: k.signalText,
        toggleSelected: k.toggleSelected, panel: k.panel, panelText: k.panelText, panelDot: k.panelDot,
        surfaceAlt: k.surfaceAlt, bar: k.bar, shadow: k.shadow, muted: k.muted,
      },
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: sans,
      fontSize: 14,
      h4: { fontSize: 26, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2 },
      h5: { fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 },
      h6: { fontSize: 16, fontWeight: 600, lineHeight: 1.35 },
      subtitle1: { fontSize: 15, fontWeight: 600 },
      subtitle2: { fontSize: 13.5, fontWeight: 600 },
      body1: { fontSize: 14.5, lineHeight: 1.55 },
      body2: { fontSize: 13.5, lineHeight: 1.5 },
      caption: { fontSize: 12.5, lineHeight: 1.45, color: k.muted },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: 'antialiased', colorScheme: mode },
          '*:focus-visible': { outline: `2px solid ${k.signal}`, outlineOffset: 2 },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: k.line } },
      },
      MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderRadius: 8 } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 6, paddingInline: 16, minHeight: 36 },
          outlined: { borderColor: k.line, color: k.ink, '&:hover': { borderColor: k.inputLine, backgroundColor: alpha(k.ink, 0.04) } },
          sizeSmall: { minHeight: 30, paddingInline: 12 },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: k.surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: k.inputLine },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: k.muted },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: k.signal, borderWidth: 1.5 },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: k.signal } } } },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, borderRadius: 999 },
          sizeSmall: { height: 22, fontSize: 12.5 },
          outlined: { borderColor: k.line },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: k.lineSoft, paddingTop: 10, paddingBottom: 10 },
          head: {
            fontSize: 12.5, fontWeight: 600, color: k.muted, backgroundColor: k.surfaceAlt,
            borderBottom: `1px solid ${k.line}`, paddingTop: 9, paddingBottom: 9, whiteSpace: 'nowrap',
          },
          stickyHeader: { backgroundColor: k.surfaceAlt },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: alpha(k.ink, 0.03) },
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: alpha(k.signal, mode === 'dark' ? 0.14 : 0.07) },
            '&:last-of-type td': { borderBottom: 0 },
          },
        },
      },
      MuiTableSortLabel: { styleOverrides: { root: { '&.Mui-active': { color: k.ink } } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: { height: 2, backgroundColor: k.signal } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none', fontWeight: 600, minHeight: 44, fontSize: 14, color: k.inkSoft, paddingInline: 14,
            '&.Mui-selected': { color: k.ink },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-checked': { color: k.ok, '& + .MuiSwitch-track': { backgroundColor: k.ok, opacity: 0.45 } } },
        },
      },
      MuiCheckbox: { styleOverrides: { root: { color: k.disabled, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: k.signal } } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 6, fontSize: 13.5, alignItems: 'center' },
          standardInfo: { backgroundColor: k.signalTint, color: k.signalText },
          standardWarning: { backgroundColor: k.amberTint, color: k.amberText },
          standardSuccess: { backgroundColor: k.okTint },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 10, boxShadow: `0 24px 64px ${k.shadow}`, border: `1px solid ${k.line}` } },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: 17, fontWeight: 600, paddingBottom: 8 } } },
      MuiDrawer: { styleOverrides: { paper: { boxShadow: `-16px 0 48px ${k.shadow}`, borderLeft: `1px solid ${k.line}` } } },
      MuiBackdrop: { styleOverrides: { root: { backgroundColor: k.backdrop } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: mode === 'dark' ? '#E6EBF2' : '#16294A', color: mode === 'dark' ? '#0E1C35' : '#FFFFFF', fontSize: 12.5, fontWeight: 500 },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: { boxShadow: `0 12px 32px ${k.shadow}`, border: `1px solid ${k.line}`, marginTop: 4 },
          option: { fontSize: 13.5 },
        },
      },
      MuiMenu: { styleOverrides: { paper: { boxShadow: `0 12px 32px ${k.shadow}`, border: `1px solid ${k.line}` } } },
      MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { color: k.signal, fontWeight: 500 } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none', fontWeight: 600, color: k.inkSoft, borderColor: k.inputLine,
            '&.Mui-selected, &.Mui-selected:hover': { color: k.ink, backgroundColor: k.toggleSelected },
          },
        },
      },
    },
  });
}

export default createAppTheme('light');
