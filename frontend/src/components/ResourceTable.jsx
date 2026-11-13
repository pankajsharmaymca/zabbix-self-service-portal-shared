import { useMemo, useState } from 'react';
import {
  Box, Checkbox, InputAdornment, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

/**
 * Table panel: toolbar (search + count), multi-select checkboxes, pagination.
 * Clicking a row calls onRowClick (or toggles the checkbox when there is none).
 *
 * columns: [{ key, label, render(row), width, cellSx, sortValue(row) }]  (sortValue makes the column sortable)
 * searchText(row): string used by the search box
 */
export default function ResourceTable({
  rows, columns, selected, onSelectedChange, onRowClick, searchText, searchPlaceholder, emptyText, noun = 'row',
  toolbarExtra, loading = false, defaultSort,
}) {
  const [sort, setSort] = useState(defaultSort || null); // { key, dir }
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term ? rows.filter((row) => searchText(row).toLowerCase().includes(term)) : [...rows];
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      list.sort((a, b) => {
        const x = col.sortValue(a);
        const y = col.sortValue(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sort.dir === 'asc' ? r : -r;
      });
    }
    return list;
  }, [rows, search, searchText, sort, columns]);

  const toggleSort = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const selectedInView = filtered.filter((r) => selected.has(r.id)).length;
  const allInViewSelected = filtered.length > 0 && selectedInView === filtered.length;

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const toggleAll = () => {
    const next = new Set(selected);
    if (allInViewSelected) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    onSelectedChange(next);
  };

  const countLabel = search.trim()
    ? `${filtered.length} of ${rows.length} ${noun}s`
    : `${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <TextField
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> },
          }}
          sx={{ maxWidth: { sm: 340 } }}
        />
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          {toolbarExtra}
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{countLabel}</Typography>
        </Stack>
      </Stack>

      <TableContainer sx={{ maxHeight: { md: 'calc(100vh - 330px)' }, minHeight: 120 }}>
        <Table size="small" stickyHeader sx={{ minWidth: { md: 760 } }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={selectedInView > 0 && !allInViewSelected}
                  checked={allInViewSelected}
                  onChange={toggleAll}
                  disabled={filtered.length === 0}
                  slotProps={{ input: { 'aria-label': 'Select all' } }}
                />
              </TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} sx={{ width: c.width, ...c.cellSx }} sortDirection={sort?.key === c.key ? sort.dir : false}>
                  {c.sortValue ? (
                    <TableSortLabel active={sort?.key === c.key} direction={sort?.key === c.key ? sort.dir : 'asc'} onClick={() => toggleSort(c.key)}>
                      {c.label}
                    </TableSortLabel>
                  ) : c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  hover
                  selected={isSelected}
                  onClick={() => (onRowClick ? onRowClick(row) : toggle(row.id))}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => toggle(row.id)}
                      slotProps={{ input: { 'aria-label': `Select ${row.name}` } }}
                    />
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={c.cellSx}>{c.render(row)}</TableCell>
                  ))}
                </TableRow>
              );
            })}
            {loading && rows.length === 0 && [0, 1, 2, 3, 4].map((i) => (
              <TableRow key={`sk${i}`}>
                <TableCell padding="checkbox"><Skeleton variant="rounded" width={18} height={18} sx={{ ml: 1.25 }} /></TableCell>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={c.cellSx}><Skeleton width={c.key === 'name' ? '70%' : '50%'} /></TableCell>
                ))}
              </TableRow>
            ))}
            {!(loading && rows.length === 0) && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1}>
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {rows.length === 0 ? emptyText : 'Nothing matches your search.'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {filtered.length > rowsPerPage && (
        <TablePagination
          component="div"
          count={filtered.length}
          page={Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-selectLabel, & .MuiTablePagination-input': { display: { xs: 'none', sm: 'flex' } } }}
        />
      )}
    </Paper>
  );
}
