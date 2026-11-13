import { useState } from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import TagField from './TagField';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const label = (t) => (t.value ? `${t.tag}: ${t.value}` : t.tag);

/**
 * Shows every tag. Own tags are filled; inherited tags (from template / host) are outlined.
 *   own:       [{tag, value}]
 *   inherited: [{tag, value, source}]
 */
export function TagChipsView({ own = [], inherited = [], size = 'small' }) {
  if (own.length === 0 && inherited.length === 0) {
    return <Typography variant="body2" color="text.disabled">No tags</Typography>;
  }
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {own.map((t, i) => (
        <Chip key={`o${i}`} size={size} label={label(t)} sx={{ bgcolor: 'custom.ownTag', color: 'custom.ownTagText', fontWeight: 600 }} />
      ))}
      {inherited.map((t, i) => (
        <Tooltip key={`i${i}`} title={`Inherited from the ${t.source}`}>
          <Chip size={size} variant="outlined" label={label(t)} sx={{ color: 'text.secondary', borderStyle: 'dashed' }} />
        </Tooltip>
      ))}
    </Stack>
  );
}

/**
 * Edit own tags as chips: click a chip to change it, ✕ to remove it.
 * New tags cannot be added here.
 */
export function TagChipsEditor({ tags, onChange, disabled }) {
  const [editing, setEditing] = useState(null); // index
  const [draft, setDraft] = useState({ tag: '', value: '' });

  const startEdit = (i) => {
    setEditing(i);
    setDraft({ ...tags[i] });
  };
  const commit = () => {
    if (!draft.tag.trim()) return;
    onChange(tags.map((t, i) => (i === editing ? { tag: draft.tag.trim(), value: draft.value.trim() } : t)));
    setEditing(null);
  };

  if (tags.length === 0) {
    return <Typography variant="body2" color="text.secondary">No tags of its own.</Typography>;
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {tags.map((t, i) => (
          <Chip
            key={i}
            label={label(t)}
            onClick={disabled ? undefined : () => startEdit(i)}
            onDelete={disabled ? undefined : () => { onChange(tags.filter((_, j) => j !== i)); setEditing(null); }}
            color={editing === i ? 'primary' : 'default'}
            sx={editing === i ? undefined : { bgcolor: 'custom.ownTag', color: 'custom.ownTagText', fontWeight: 600 }}
            aria-label={`Tag ${label(t)}`}
          />
        ))}
      </Stack>
      {editing !== null && (
        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); commit(); }}
          sx={{ p: 1.5, border: 1, borderColor: 'primary.light', borderRadius: 2, bgcolor: 'custom.surfaceAlt' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TagField kind="tag" label="Tag" value={draft.tag} autoFocus onChange={(v) => setDraft((d) => ({ ...d, tag: v }))} error={!draft.tag.trim()} />
            <TagField kind="value" tagName={draft.tag} label="Value" value={draft.value} onChange={(v) => setDraft((d) => ({ ...d, value: v }))} />
            <IconButton type="submit" color="primary" aria-label="Apply tag change" disabled={!draft.tag.trim()}><CheckRoundedIcon /></IconButton>
            <IconButton aria-label="Cancel tag change" onClick={() => setEditing(null)}><CloseRoundedIcon /></IconButton>
          </Stack>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">Click a tag to change it, ✕ to remove it.</Typography>
    </Stack>
  );
}
