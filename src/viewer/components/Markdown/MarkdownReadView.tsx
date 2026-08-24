import { useLayoutEffect, useMemo, useRef } from 'react';
import { parseMarkdown } from '../../../lib/markdown-pipeline';
import {
  areTableIdentityRecordsEqual,
  getTableIdentityCandidate,
  matchTableIdentities,
  persistTableIdentities,
  readPersistedTableIdentities,
  type TableIdentityRecord,
} from './FeishuTableIdentity';

interface MarkdownReadViewProps {
  content: string;
}

export function MarkdownReadView({ content }: MarkdownReadViewProps) {
  const rendered = useMemo(() => parseMarkdown(content), [content]);
  const rootRef = useRef<HTMLDivElement>(null);
  const tableIdentityRecordsRef = useRef<TableIdentityRecord[] | null>(null);
  if (tableIdentityRecordsRef.current === null) {
    tableIdentityRecordsRef.current = readPersistedTableIdentities();
  }

  useLayoutEffect(() => {
    const syncTableIdentities = () => {
      const root = rootRef.current;
      if (!root) return;

      const persisted = readPersistedTableIdentities();
      if (persisted.length > 0) {
        tableIdentityRecordsRef.current = persisted;
      }

      const tables = Array.from(root.querySelectorAll<HTMLTableElement>('.feishu-table__scrollport > table'));
      const candidates = tables
        .map(getTableIdentityCandidate)
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
      let generatedId = 0;
      const matched = matchTableIdentities(
        tableIdentityRecordsRef.current ?? [],
        candidates,
        () => {
          generatedId += 1;
          return `table-runtime-${Date.now().toString(36)}-${generatedId.toString(36)}`;
        },
      );

      // A freshly rendered document starts with the pipeline's candidate IDs.
      // Reapply the persisted IDs before the equality fast path; the snapshot
      // comparison intentionally ignores transient currentId values, so doing
      // this after the early return would leave reopened tables on new IDs and
      // prevent their persisted widths from being found.
      matched.forEach((record) => {
        const table = tables.find((candidate) => candidate.dataset.feishuTableId === record.currentId);
        if (table) table.dataset.feishuTableId = record.id;
      });

      if (areTableIdentityRecordsEqual(tableIdentityRecordsRef.current ?? [], matched)) {
        // The table component can mount before this identity pass (notably
        // when a VS Code Webview restores a host snapshot). It may therefore
        // have tried to restore widths using the transient runtime id. Even
        // when the persisted snapshot is otherwise equal, notify mounted
        // tables after remapping so they read the now-stable id again.
        window.dispatchEvent(new Event('feishu-table-widths-updated'));
        return;
      }

      tableIdentityRecordsRef.current = matched;
      persistTableIdentities(matched);

      // FeishuTable restores its widths in a passive effect. Dispatching after
      // remapping lets that effect read the new identity before restoring.
      window.dispatchEvent(new Event('feishu-table-widths-updated'));
    };

    syncTableIdentities();
    window.addEventListener('feishu-table-identities-updated', syncTableIdentities);
    return () => window.removeEventListener('feishu-table-identities-updated', syncTableIdentities);
  }, [rendered]);

  return (
    <div ref={rootRef} className="feishu-markdown-body">
      {rendered}
    </div>
  );
}
