import { getTableColumnWidthsBridge } from './FeishuTableColumnWidths';

export interface TableIdentityCandidate {
  currentId: string;
  headingPath: string;
  text: string;
  columnCount: number;
  ordinal: number;
}

export interface TableIdentityRecord extends TableIdentityCandidate {
  id: string;
}

export function areTableIdentityRecordsEqual(
  left: TableIdentityRecord[],
  right: TableIdentityRecord[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((record, index) => {
    const other = right[index];
    if (!other) return false;
    return record.id === other.id
      && record.headingPath === other.headingPath
      && record.text === other.text
      && record.columnCount === other.columnCount
      && record.ordinal === other.ordinal;
  });
}

const IDENTITY_STORAGE_PREFIX = 'feishu-md-viewer:table-identities:v1';

interface PersistedTableIdentities {
  version: 1;
  records: TableIdentityRecord[];
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getIdentityStorageKey(): string {
  const locationKey = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${IDENTITY_STORAGE_PREFIX}:${hashText(locationKey)}`;
}

function sanitizeRecords(value: unknown): TableIdentityRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((record): record is Partial<TableIdentityRecord> => typeof record === 'object' && record !== null)
    .map((record) => ({
      id: typeof record.id === 'string' ? record.id : '',
      currentId: typeof record.currentId === 'string' ? record.currentId : '',
      headingPath: typeof record.headingPath === 'string' ? record.headingPath : '',
      text: typeof record.text === 'string' ? record.text.slice(0, 1200) : '',
      columnCount: typeof record.columnCount === 'number' ? Math.max(0, Math.round(record.columnCount)) : 0,
      ordinal: typeof record.ordinal === 'number' ? Math.max(0, Math.round(record.ordinal)) : 0,
    }))
    .filter((record) => record.id.length > 0 && record.headingPath.length > 0)
    .slice(0, 200);
}

export function readPersistedTableIdentities(): TableIdentityRecord[] {
  const bridge = getTableColumnWidthsBridge();
  if (bridge?.readIdentities) return sanitizeRecords(bridge.readIdentities());

  try {
    const raw = window.localStorage.getItem(getIdentityStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedTableIdentities>;
    return parsed.version === 1 ? sanitizeRecords(parsed.records) : [];
  } catch {
    return [];
  }
}

export function persistTableIdentities(records: TableIdentityRecord[]): void {
  const safeRecords = sanitizeRecords(records);
  const bridge = getTableColumnWidthsBridge();
  if (bridge?.writeIdentities) {
    bridge.writeIdentities(safeRecords);
    return;
  }

  try {
    window.localStorage.setItem(
      getIdentityStorageKey(),
      JSON.stringify({ version: 1, records: safeRecords } satisfies PersistedTableIdentities),
    );
  } catch {
    // 身份缓存失败时仍可使用当前会话内的表格身份。
  }
}

function getTableColumnCount(table: HTMLTableElement): number {
  return Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0);
}

export function getTableIdentityCandidate(table: HTMLTableElement): TableIdentityCandidate | null {
  const currentId = table.dataset.feishuTableId?.trim();
  const headingPath = table.dataset.feishuTablePath?.trim();
  if (!currentId || !headingPath) return null;

  const parsedOrdinal = Number.parseInt(table.dataset.feishuTableOrdinal ?? '', 10);
  const normalizedText = (table.textContent ?? '').replace(/\s+/g, ' ').trim();
  const text = normalizedText.length > 1200
    ? `${normalizedText.slice(0, 600)}…${normalizedText.slice(-600)}`
    : normalizedText;

  return {
    currentId,
    headingPath,
    text,
    columnCount: getTableColumnCount(table),
    ordinal: Number.isFinite(parsedOrdinal) ? parsedOrdinal - 1 : 0,
  };
}

export function matchTableIdentities(
  previous: TableIdentityRecord[],
  current: TableIdentityCandidate[],
  createId: (candidate: TableIdentityCandidate) => string,
): TableIdentityRecord[] {
  const previousByHeading = new Map<string, TableIdentityRecord[]>();
  const currentByHeading = new Map<string, TableIdentityCandidate[]>();

  previous.forEach((record) => {
    const group = previousByHeading.get(record.headingPath) ?? [];
    group.push(record);
    previousByHeading.set(record.headingPath, group);
  });
  current.forEach((candidate) => {
    const group = currentByHeading.get(candidate.headingPath) ?? [];
    group.push(candidate);
    currentByHeading.set(candidate.headingPath, group);
  });

  const matchedIds = new Map<string, string>();
  currentByHeading.forEach((currentGroup, headingPath) => {
    const previousGroup = previousByHeading.get(headingPath) ?? [];
    const pairCount = Math.min(previousGroup.length, currentGroup.length);
    for (let index = 0; index < pairCount; index += 1) {
      const previousRecord = previousGroup[index];
      const currentCandidate = currentGroup[index];
      if (previousRecord && currentCandidate) matchedIds.set(currentCandidate.currentId, previousRecord.id);
    }
  });

  return current.map((candidate) => ({
    ...candidate,
    id: matchedIds.get(candidate.currentId) ?? createId(candidate),
  }));
}
