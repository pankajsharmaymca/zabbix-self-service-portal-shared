import { IconButton, Stack, Typography } from '@mui/material';
import TagField from './TagField';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

/** Edit or remove existing { tag, value } rows (names/values suggested from Zabbix). New tags cannot be added here. */
export default function TagEditor({ tags, onChange, disabled }) {
  const update = (index, field, value) =>
    onChange(tags.map((t, i) => (i === index ? { ...t, [field]: value } : t)));

  if (tags.length === 0) {
    return <Typography variant="body2" color="text.secondary">No tags.</Typography>;
  }

  return (
    <Stack spacing={1.25}>
      {tags.map((t, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TagField kind="tag" label="Tag" value={t.tag} disabled={disabled}
            onChange={(v) => update(i, 'tag', v)} error={!t.tag.trim()} />
          <TagField kind="value" tagName={t.tag} label="Value" value={t.value} disabled={disabled}
            onChange={(v) => update(i, 'value', v)} />
          <IconButton
            aria-label={`Remove tag ${t.tag}`}
            disabled={disabled}
            onClick={() => onChange(tags.filter((_, j) => j !== i))}
          >
            <DeleteOutlineRoundedIcon />
          </IconButton>
        </Stack>
      ))}
    </Stack>
  );
}

export const tagsValid = (tags) => tags.every((t) => t.tag.trim());
export const cleanTags = (tags) => tags.map((t) => ({ tag: t.tag.trim(), value: (t.value || '').trim() }));
export const tagLabels = (tags) => tags.map((t) => (t.value ? `${t.tag}: ${t.value}` : t.tag));
export const sameTags = (a, b) => JSON.stringify(cleanTags(a)) === JSON.stringify(cleanTags(b));
