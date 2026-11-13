import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, Drawer, IconButton, LinearProgress, Stack, Tab, Tabs, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { TagSuggestionsContext, usePageTitle, useRefreshOnFocus } from '../live';
import { api } from '../api';
import { useTemplateConfirm } from './editor/common';
import ItemsPanel from './editor/ItemsPanel';
import TriggersPanel from './editor/TriggersPanel';
import MacrosPanel from './editor/MacrosPanel';
import TagsPanel from './editor/TagsPanel';
import WebPanel from './editor/WebPanel';

/**
 * One linked template, opened from a host.
 *   Items, triggers, web checks (incl. enable/disable), macros, template tags → saved on the TEMPLATE
 *     (confirmed first, applies to every linked host)
 *   Host tags, removing a host's own macro value                            → saved on this host
 */
export default function TemplateEditor({ host, template, onClose, notify }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [view, setView] = useState(null);
  usePageTitle(`${template.name} on ${host.name}`);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('items');
  const [reloading, setReloading] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [confirmTemplate, confirmDialog] = useTemplateConfirm(template.name, view?.templateHostCount ?? 0);

  // Reads the template view (and the tag suggestions) live from Zabbix; returns the fresh view.
  const load = useCallback(async () => {
    setReloading(true);
    try {
      const [fresh, tags] = await Promise.all([
        api.templateView(host.id, template.id),
        api.tagSuggestions(host.id).catch(() => null),
      ]);
      setView(fresh);
      if (tags) setSuggestions(tags);
      setLoadedAt(new Date());
      setError('');
      return fresh;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setReloading(false);
    }
  }, [host.id, template.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Everything is read live from Zabbix: reload when the user comes back to the tab
  useRefreshOnFocus(load);

  const count = (list) => (view ? ` (${list(view).length})` : '');
  /**
   * Opens an edit window with values fresh from Zabbix: reloads first, then hands the current version
   * of the object to `open`. Warns if it no longer exists.
   */
  const openFresh = useCallback(async (pick, open) => {
    const fresh = await load();
    if (!fresh) return;
    const obj = pick(fresh);
    if (obj) open(obj);
    else notify('It no longer exists in Zabbix. The list has been refreshed.', 'warning');
  }, [load, notify]);

  const panelProps = { view, hostId: host.id, reload: load, openFresh, notify, compact: fullScreen, confirmTemplate };

  const tabLabel = (label, list) => (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <span>{label}</span>
      {view && list && (
        <Chip size="small" label={list(view).length} sx={{ height: 20, fontSize: 12, bgcolor: 'custom.chip', color: 'text.secondary' }} />
      )}
    </Stack>
  );

  return (
    <TagSuggestionsContext.Provider value={suggestions}>
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', md: 'min(1180px, 88vw)' }, display: 'flex', flexDirection: 'column' } } }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 0, borderBottom: 1, borderColor: 'divider', position: 'relative' }}>
        <Typography variant="caption" component="div">Template</Typography>
        <Typography variant="h5" component="h2" sx={{ pr: 6, wordBreak: 'break-word' }}>{template.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Opened from <b>{host.name}</b>
          {view ? `. Linked to ${view.templateHostCount} host${view.templateHostCount === 1 ? '' : 's'}; changes here apply to all of them.` : '.'}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 14 }}>
          <CloseRoundedIcon />
        </IconButton>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); load(); }} sx={{ mt: 1.5, mx: -1 }} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="items" label={tabLabel('Items', (v) => v.items)} aria-label={`Items${count((v) => v.items)}`} />
          <Tab value="triggers" label={tabLabel('Triggers', (v) => v.triggers)} aria-label={`Triggers${count((v) => v.triggers)}`} />
          <Tab value="macros" label={tabLabel('Macros', (v) => v.macros)} aria-label={`Macros${count((v) => v.macros)}`} />
          <Tab value="tags" label={tabLabel('Tags')} aria-label="Tags" />
          <Tab value="web" label={tabLabel('Web', (v) => v.webScenarios)} aria-label={`Web${count((v) => v.webScenarios)}`} />
        </Tabs>
      </Box>
      <Box sx={{ height: 2 }}>{reloading && <LinearProgress sx={{ height: 2 }} />}</Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!view ? (
          !error && <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            {tab === 'items' && <ItemsPanel {...panelProps} />}
            {tab === 'triggers' && <TriggersPanel {...panelProps} />}
            {tab === 'macros' && <MacrosPanel {...panelProps} />}
            {tab === 'tags' && <TagsPanel {...panelProps} />}
            {tab === 'web' && <WebPanel {...panelProps} />}
          </>
        )}
        {loadedAt && (
          <Typography variant="caption" component="p" sx={{ mt: 2, color: 'text.disabled' }}>
            Loaded from Zabbix at {loadedAt.toLocaleTimeString()}
          </Typography>
        )}
      </Box>
      {confirmDialog}
    </Drawer>
    </TagSuggestionsContext.Provider>
  );
}
