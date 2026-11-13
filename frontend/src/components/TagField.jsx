import { Autocomplete, TextField, createFilterOptions } from '@mui/material';
import { useTagSuggestions } from '../live';

const filter = createFilterOptions({ limit: 50 });

/**
 * Text field for a tag name or value that suggests what already exists in Zabbix.
 * Typing anything else is still allowed.
 *   kind: 'tag' (suggest tag names) or 'value' (suggest values used with `tagName`)
 */
export default function TagField({ kind, tagName, label, value, onChange, error, disabled, autoFocus }) {
  const suggestions = useTagSuggestions();
  const options = kind === 'tag' ? Object.keys(suggestions) : suggestions[tagName?.trim()] || [];

  return (
    <Autocomplete
      freeSolo
      disableClearable
      options={options}
      filterOptions={filter}
      inputValue={value}
      onInputChange={(_, v, reason) => { if (reason !== 'reset' || v) onChange(v); }}
      disabled={disabled}
      fullWidth
      size="small"
      renderInput={(params) => (
        <TextField {...params} label={label} error={error} autoFocus={autoFocus} />
      )}
    />
  );
}
