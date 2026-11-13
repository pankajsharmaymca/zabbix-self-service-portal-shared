import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { api } from '../../api';
import TagEditor, { cleanTags, sameTags, tagsValid } from '../TagEditor';
import { tagsText } from './common';

/** Tags: template tags (saved on the template) and host tags (saved on this host). Edit or remove only. */
export default function TagsPanel({ view, hostId, reload, notify, confirmTemplate }) {
  return (
    <Stack spacing={3}>
      <TagSection
        title="Template tags"
        caption={`Saved on the template ${view.template.name}, so all ${view.templateHostCount} linked host${view.templateHostCount === 1 ? '' : 's'} get the change.`}
        tags={view.templateTags}
        warning
        onSave={async (tags) => {
          if (!(await confirmTemplate('Changing the template tags', [
            { label: 'Template tags', from: tagsText(view.templateTags), to: tagsText(tags) },
          ]))) return false;
          await api.setTemplateTags(hostId, view.template.id, tags);
          notify('Template tags saved');
          return true;
        }}
        reload={reload}
      />
      <TagSection
        title="Host tags"
        caption={`Tags of ${view.host.name} only.`}
        tags={view.hostTags}
        onSave={async (tags) => {
          await api.setHostTags(hostId, tags);
          notify('Host tags saved');
          return true;
        }}
        reload={reload}
      />
    </Stack>
  );
}

function TagSection({ title, caption, tags: original, warning, onSave, reload }) {
  const [tags, setTags] = useState(original.map((t) => ({ ...t })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changed = !sameTags(tags, original);

  // Only reset when the saved tags changed (not on every refresh), so edits in progress aren't lost.
  const originalKey = JSON.stringify(original);
  useEffect(() => {
    setTags(JSON.parse(originalKey));
  }, [originalKey]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (await onSave(cleanTags(tags))) await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" component="h3">{title}</Typography>
      <Typography variant="caption" color={warning ? 'warning.dark' : 'text.secondary'} component="div" sx={{ mb: 1.5 }}>
        {caption}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TagEditor tags={tags} onChange={setTags} disabled={saving} />
      {original.length > 0 && (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button disabled={!changed || saving} onClick={() => setTags(original.map((t) => ({ ...t })))}>Undo</Button>
          <Button
            variant="contained"
            disabled={!changed || !tagsValid(tags) || saving}
            onClick={save}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Save {title.toLowerCase()}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
