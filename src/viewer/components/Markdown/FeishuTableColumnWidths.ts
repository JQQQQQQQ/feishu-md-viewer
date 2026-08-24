import type { TableIdentityRecord } from './FeishuTableIdentity';

const STORAGE_PREFIX = 'feishu-md-viewer:table-column-widths:v1';
const STORAGE_VERSION = 1;
const MIN_STORED_WIDTH = 24;

interface PersistedTableWidths {
  version: 1;
  updatedAt: number;
  widths: number[];
}

export interface TableColumnWidthsBridge {
  read(tableKey: string): number[] | null;
  write(tableKey: string, widths: number[]): void;
  readIdentities?: () => TableIdentityRecord[] | null;
  writeIdentities?: (records: TableIdentityRecord[]) => void;
}

let tableColumnWidthsBridge: TableColumnWidthsBridge | undefined;

export function setTableColumnWidthsBridge(bridge: TableColumnWidthsBridge | undefined): void {
  tableColumnWidthsBridge = bridge;
}

export function getTableColumnWidthsBridge(): TableColumnWidthsBridge | undefined {
  return tableColumnWidthsBridge;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getDocumentKey(): string {
  const locationKey = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return hashText(locationKey);
}

function getCellText(cell: HTMLTableCellElement): string {
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function getColumnCount(table: HTMLTableElement): number {
  return Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
}

function getTableFingerprint(table: HTMLTableElement): string {
  const rows = Array.from(table.rows).slice(0, 4);
  const sample = rows
    .map((row) => Array.from(row.cells).map(getCellText).join('|'))
    .join('\n');

  return `${getColumnCount(table)}\n${sample}`;
}

export function getTableFingerprintKey(table: HTMLTableElement): string {
  return hashText(getTableFingerprint(table));
}

export function getTablePersistenceKey(table: HTMLTableElement): string {
  const stableId = table.dataset.feishuTableId?.trim();
  return stableId ? `stable:${stableId}` : getTableFingerprintKey(table);
}

export function getTableWidthStorageKey(table: HTMLTableElement): string {
  return `${STORAGE_PREFIX}:${getDocumentKey()}:${hashText(getTableFingerprint(table))}`;
}

function getStableTableWidthStorageKey(table: HTMLTableElement): string {
  return `${STORAGE_PREFIX}:${getDocumentKey()}:${hashText(getTablePersistenceKey(table))}`;
}

function parseWidth(value: string): number | null {
  const width = Number.parseFloat(value);
  return Number.isFinite(width) && width >= MIN_STORED_WIDTH ? Math.round(width) : null;
}

function getColumnWidth(table: HTMLTableElement, colIndex: number): number | null {
  const cells = Array.from(table.rows)
    .map((row) => row.cells[colIndex])
    .filter((cell): cell is HTMLTableCellElement => Boolean(cell));

  for (const cell of cells) {
    const styleWidth = parseWidth(cell.style.width);
    if (styleWidth !== null) return styleWidth;
  }

  const measuredWidth = cells
    .map((cell) => parseWidth(`${cell.getBoundingClientRect().width}`))
    .find((width): width is number => width !== null);

  return measuredWidth ?? null;
}

export function getTableColumnWidths(table: HTMLTableElement): number[] {
  return Array.from({ length: getColumnCount(table) }, (_, colIndex) => getColumnWidth(table, colIndex) ?? 0);
}

export function applyTableColumnWidths(table: HTMLTableElement, widths: number[]): void {
  widths.forEach((width, colIndex) => {
    if (!Number.isFinite(width) || width < MIN_STORED_WIDTH) return;

    Array.from(table.rows).forEach((row) => {
      const cell = row.cells[colIndex];
      if (!cell) return;

      cell.style.width = `${Math.round(width)}px`;
      cell.style.minWidth = `${Math.round(width)}px`;
      cell.style.maxWidth = `${Math.round(width)}px`;
    });
  });
}

export function readPersistedTableColumnWidths(table: HTMLTableElement): number[] | null {
  const stableTableKey = getTablePersistenceKey(table);
  const legacyTableKey = getTableFingerprintKey(table);
  if (tableColumnWidthsBridge) {
    return tableColumnWidthsBridge.read(stableTableKey)
      ?? (stableTableKey === legacyTableKey ? null : tableColumnWidthsBridge.read(legacyTableKey));
  }

  try {
    const storageKeys = stableTableKey === legacyTableKey
      ? [getTableWidthStorageKey(table)]
      : [getStableTableWidthStorageKey(table), getTableWidthStorageKey(table)];
    const raw = storageKeys
      .map((key) => window.localStorage.getItem(key))
      .find((value): value is string => Boolean(value));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedTableWidths>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.widths)) return null;

    return parsed.widths.filter((width) => Number.isFinite(width));
  } catch {
    return null;
  }
}

export function restorePersistedTableColumnWidths(table: HTMLTableElement): boolean {
  const widths = readPersistedTableColumnWidths(table);
  if (!widths) return false;

  applyTableColumnWidths(table, widths);
  return true;
}

export function persistTableColumnWidths(table: HTMLTableElement): void {
  const widths = getTableColumnWidths(table);
  if (widths.every((width) => width < MIN_STORED_WIDTH)) return;

  const tableKey = getTablePersistenceKey(table);
  if (tableColumnWidthsBridge) {
    tableColumnWidthsBridge.write(tableKey, widths);
    return;
  }

  try {
    window.localStorage.setItem(
      table.dataset.feishuTableId?.trim()
        ? getStableTableWidthStorageKey(table)
        : getTableWidthStorageKey(table),
      JSON.stringify({ version: STORAGE_VERSION, updatedAt: Date.now(), widths } satisfies PersistedTableWidths)
    );
  } catch {
    // Ignore storage failures; resizing should still work in private or restricted contexts.
  }
}
