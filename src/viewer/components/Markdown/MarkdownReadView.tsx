import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  collectMarkdownDocumentMetadata,
  parseMarkdown,
  parseMarkdownBlock,
  type MarkdownDocumentMetadata,
} from '../../../lib/markdown-pipeline';
import {
  diffMarkdownBlocks,
  indexMarkdownBlocks,
  type MarkdownBlock,
} from '../../../lib/markdown-blocks';
import type { MarkdownSourceContext } from '../../../lib/markdown-resource-resolver';
import { getMarkdownContentHash, getMarkdownSourceContextKey, markMarkdownPhase, measureMarkdownPhase } from '../../../lib/markdown-performance';
import {
  chunkMarkdownBlocks,
  classifyMarkdownRenderStrategy,
  createBrowserProgressiveRenderScheduler,
  getInitialMarkdownBatchCount,
  getMarkdownRenderShape,
  MARKDOWN_NAVIGATION_BATCHES_PER_TURN,
  MARKDOWN_HEADINGS_CHANGED_EVENT,
  MARKDOWN_HEADING_READY_EVENT,
  MARKDOWN_TOC_NAVIGATE_EVENT,
  type ProgressiveRenderScheduler,
} from '../../../lib/markdown-progressive-render';
import { setMermaidRenderCounter } from './CodeBlock/CodeBlock';
import {
  areTableIdentityRecordsEqual,
  getTableIdentityCandidate,
  matchTableIdentities,
  persistTableIdentities,
  readPersistedTableIdentities,
  type TableIdentityRecord,
} from './FeishuTableIdentity';
import { ImagePreviewProvider } from './ImagePreview';
import { MarkdownBlockView } from './MarkdownBlockView';
import { DocumentSearch } from '../Search/DocumentSearch';

interface MarkdownReadViewProps {
  content: string;
  sourceContext?: MarkdownSourceContext;
}

function decodeAnchorHash(hash: string): string | null {
  if (!hash || hash === '#') return null;

  const rawId = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!rawId) return null;

  try {
    return decodeURIComponent(rawId);
  } catch {
    // Keep the raw fragment when a URL contains malformed encoding.
    return rawId;
  }
}

function scrollToAnchor(root: HTMLElement, hash: string): boolean {
  const targetId = decodeAnchorHash(hash);
  if (!targetId) return false;

  const target = Array.from(root.querySelectorAll<HTMLElement>('[id]'))
    .find((element) => element.id === targetId || element.id === `user-content-${targetId}`);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    return true;
  }
  return false;
}

interface MarkdownRenderModel {
  blocks: MarkdownBlock[];
  batches: MarkdownBlock[][];
  batchMermaidOffsets: number[];
  remainingPlaceholderHeights: number[];
  metadata: MarkdownDocumentMetadata;
  renderedByKey: Map<string, ReturnType<typeof parseMarkdownBlock>>;
  fullRendered?: ReturnType<typeof parseMarkdown>;
  strategy: 'sync' | 'progressive';
  modelKey: string;
  sourceContextKey: string;
}

const MAX_REUSABLE_RENDERED_BLOCKS = 480;

function limitReusableRenderedBlocks(
  renderedByKey: Map<string, ReturnType<typeof parseMarkdownBlock>>,
): Map<string, ReturnType<typeof parseMarkdownBlock>> {
  if (renderedByKey.size <= MAX_REUSABLE_RENDERED_BLOCKS) return new Map(renderedByKey);
  return new Map(Array.from(renderedByKey.entries()).slice(-MAX_REUSABLE_RENDERED_BLOCKS));
}

function selectRenderedBatches(
  renderedByKey: Map<string, ReturnType<typeof parseMarkdownBlock>>,
  batches: MarkdownBlock[][],
  startIndex: number,
  endIndex: number,
): Map<string, ReturnType<typeof parseMarkdownBlock>> {
  const selected = new Map<string, ReturnType<typeof parseMarkdownBlock>>();
  batches.slice(startIndex, endIndex).flat().forEach((block) => {
    const rendered = renderedByKey.get(block.renderKey);
    if (rendered) selected.set(block.renderKey, rendered);
  });
  return selected;
}

function countMermaidBlocks(blocks: MarkdownBlock[]): number {
  return blocks.reduce((count, block) => count + (block.kind === 'mermaid' ? 1 : 0), 0);
}

function renderMarkdownBlocks(
  blocks: MarkdownBlock[],
  sourceContext: MarkdownSourceContext | undefined,
  metadata: MarkdownDocumentMetadata,
  reusable: Map<string, ReturnType<typeof parseMarkdownBlock>>,
  mermaidOffset = 0,
): Map<string, ReturnType<typeof parseMarkdownBlock>> {
  const renderedByKey = new Map<string, ReturnType<typeof parseMarkdownBlock>>();
  setMermaidRenderCounter(mermaidOffset);
  let mermaidCount = mermaidOffset;
  blocks.forEach((block) => {
    const reused = reusable.get(block.renderKey);
    if (reused) {
      renderedByKey.set(block.renderKey, reused);
    } else {
      setMermaidRenderCounter(mermaidCount);
      renderedByKey.set(block.renderKey, parseMarkdownBlock(block, sourceContext, metadata));
    }
    if (block.kind === 'mermaid') mermaidCount += 1;
  });
  return renderedByKey;
}

function getBatchEstimatedHeight(batch: MarkdownBlock[]): number {
  const lines = batch.reduce(
    (total, block) => total + Math.max(1, block.endLine - block.startLine + 1),
    0,
  );
  return Math.max(120, lines * 24);
}

function getBatchMermaidOffsets(batches: MarkdownBlock[][]): number[] {
  const offsets: number[] = [];
  let count = 0;
  batches.forEach((batch) => {
    offsets.push(count);
    count += countMermaidBlocks(batch);
  });
  return offsets;
}

function getRemainingPlaceholderHeights(batches: MarkdownBlock[][]): number[] {
  const heights = new Array<number>(batches.length + 1).fill(0);
  for (let index = batches.length - 1; index >= 0; index -= 1) {
    heights[index] = Math.min(160_000, (heights[index + 1] ?? 0) + getBatchEstimatedHeight(batches[index] ?? []));
  }
  return heights;
}

function getLeadingPlaceholderHeight(batches: MarkdownBlock[][], endIndex: number): number {
  let height = 0;
  for (let index = 0; index < endIndex; index += 1) {
    height = Math.min(160_000, height + getBatchEstimatedHeight(batches[index] ?? []));
    if (height >= 160_000) break;
  }
  return height;
}

function findHeadingBatchIndex(model: MarkdownRenderModel, headingId: string, headingText = ''): number | null {
  if (!headingId && !headingText) return null;
  const batchIndex = model.batches.findIndex((batch) => batch.some((block) => {
    if (block.kind !== 'heading') return false;
    const metadata = model.metadata.headings.get(block.headingPath.join('/'));
    return metadata?.id === headingId
      || metadata?.id === `user-content-${headingId}`
      || (Boolean(headingText) && metadata?.text === headingText);
  }));
  return batchIndex >= 0 ? batchIndex : null;
}

export function MarkdownReadView({ content, sourceContext }: MarkdownReadViewProps) {
  const previousModelRef = useRef<MarkdownRenderModel | null>(null);
  const renderedCacheRef = useRef<Map<string, ReturnType<typeof parseMarkdownBlock>>>(new Map());
  const schedulerRef = useRef<ProgressiveRenderScheduler | null>(null);
  const progressiveMapRef = useRef<Map<string, ReturnType<typeof parseMarkdownBlock>>>(new Map());
  const progressivePlaceholderRef = useRef<HTMLDivElement | null>(null);
  const progressiveTopPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const lastResolvedHeadingRef = useRef<{ id: string; text: string } | null>(null);
  const lastTableIdentitySyncKeyRef = useRef<string | null>(null);
  const [requestedHeading, setRequestedHeading] = useState<{ id: string; text: string } | null>(null);
  const [progressiveState, setProgressiveState] = useState<{
    modelKey: string;
    renderedByKey: Map<string, ReturnType<typeof parseMarkdownBlock>>;
    committedBatchCount: number;
    visibleBatchStartIndex: number;
    visibleBatchEndIndex: number;
  }>({
    modelKey: '',
    renderedByKey: new Map(),
    committedBatchCount: 0,
    visibleBatchStartIndex: 0,
    visibleBatchEndIndex: 0,
  });
  const model = useMemo<MarkdownRenderModel>(() => {
    const blocks = measureMarkdownPhase('markdown-index', () => indexMarkdownBlocks(content));
    const metadata = collectMarkdownDocumentMetadata(blocks);
    const sourceContextKey = getMarkdownSourceContextKey(sourceContext);
    const modelKey = `${getMarkdownContentHash(content)}::${sourceContextKey}`;
    const previous = previousModelRef.current;
    const canDiff = previous?.sourceContextKey === sourceContextKey;
    const diff = canDiff && previous
      ? diffMarkdownBlocks(previous.blocks, blocks)
      : undefined;

    if (diff?.requiresFullParse) {
      const fullRendered = parseMarkdown(content, sourceContext);
      const nextModel: MarkdownRenderModel = {
        blocks,
        batches: [],
        batchMermaidOffsets: [],
        remainingPlaceholderHeights: [0],
        metadata,
        renderedByKey: new Map(),
        fullRendered,
        strategy: 'sync',
        modelKey,
        sourceContextKey,
      };
      previousModelRef.current = nextModel;
      renderedCacheRef.current = new Map();
      return nextModel;
    }

    const shape = getMarkdownRenderShape(blocks);
    const strategy = classifyMarkdownRenderStrategy(shape);
    const batches = strategy === 'progressive' ? chunkMarkdownBlocks(blocks) : [blocks];
    const reusable = canDiff ? renderedCacheRef.current : new Map();
    const initialBlocks = batches[0] ?? [];
    const renderedByKey = renderMarkdownBlocks(
      strategy === 'progressive' ? initialBlocks : blocks,
      sourceContext,
      metadata,
      reusable,
    );

    const nextModel: MarkdownRenderModel = {
      blocks,
      batches,
      batchMermaidOffsets: getBatchMermaidOffsets(batches),
      remainingPlaceholderHeights: getRemainingPlaceholderHeights(strategy === 'progressive' ? batches : []),
      metadata,
      renderedByKey,
      strategy,
      modelKey,
      sourceContextKey,
    };
    previousModelRef.current = nextModel;
    renderedCacheRef.current = new Map(renderedByKey);
    return nextModel;
  }, [content, sourceContext]);

  const committedBatchCount = model.strategy === 'progressive'
    && progressiveState.modelKey === model.modelKey
    ? progressiveState.committedBatchCount
    : getInitialMarkdownBatchCount(model.batches.length);
  const activeRenderedByKey = model.strategy === 'progressive'
    && progressiveState.modelKey === model.modelKey
    ? progressiveState.renderedByKey
    : model.renderedByKey;
  const visibleBatchStartIndex = model.strategy === 'progressive'
    && progressiveState.modelKey === model.modelKey
    ? progressiveState.visibleBatchStartIndex
    : 0;
  const visibleBatchEndIndex = model.strategy === 'progressive'
    && progressiveState.modelKey === model.modelKey
    ? progressiveState.visibleBatchEndIndex
    : getInitialMarkdownBatchCount(model.batches.length);
  const visibleTableIdentitySyncKey = useMemo(() => {
    const visibleBatches = model.strategy === 'progressive'
      ? model.batches.slice(visibleBatchStartIndex, visibleBatchEndIndex)
      : [model.blocks];
    const tableKeys = visibleBatches
      .flat()
      .filter((block) => block.kind === 'table')
      .map((block) => block.renderKey);
    return `${model.modelKey}:${tableKeys.join('|')}`;
  }, [model, visibleBatchEndIndex, visibleBatchStartIndex]);
  const searchContentVersion = `${model.modelKey}:${visibleBatchStartIndex}:${visibleBatchEndIndex}`;

  useLayoutEffect(() => {
    if (!schedulerRef.current) {
      schedulerRef.current = createBrowserProgressiveRenderScheduler();
    }
    const scheduler = schedulerRef.current;
    scheduler.cancel();

    if (model.strategy !== 'progressive') {
      progressiveMapRef.current = new Map();
      setProgressiveState({
        modelKey: model.modelKey,
        renderedByKey: model.renderedByKey,
        committedBatchCount: 0,
        visibleBatchStartIndex: 0,
        visibleBatchEndIndex: 0,
      });
      return () => scheduler.cancel();
    }

    progressiveMapRef.current = new Map(model.renderedByKey);
    setProgressiveState({
      modelKey: model.modelKey,
      renderedByKey: progressiveMapRef.current,
      committedBatchCount: getInitialMarkdownBatchCount(model.batches.length),
      visibleBatchStartIndex: 0,
      visibleBatchEndIndex: getInitialMarkdownBatchCount(model.batches.length),
    });
    const restoreHeading = lastResolvedHeadingRef.current;
    if (restoreHeading && findHeadingBatchIndex(model, restoreHeading.id, restoreHeading.text) !== null) {
      setRequestedHeading(restoreHeading);
    } else {
      setRequestedHeading(null);
    }

    return () => scheduler.cancel();
  }, [model, sourceContext]);

  useEffect(() => {
    const handleTocNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: unknown; text?: unknown }>).detail;
      const id = detail?.id;
      const text = detail?.text;
      if (typeof id !== 'string' || !id) return;
      if (model.strategy !== 'progressive' || findHeadingBatchIndex(model, id, typeof text === 'string' ? text : '') === null) return;
      setRequestedHeading({ id, text: typeof text === 'string' ? text : '' });
    };

    window.addEventListener(MARKDOWN_TOC_NAVIGATE_EVENT, handleTocNavigate);
    return () => window.removeEventListener(MARKDOWN_TOC_NAVIGATE_EVENT, handleTocNavigate);
  }, [model]);
  const rootRef = useRef<HTMLDivElement>(null);
  const initialAnchorHashRef = useRef<string | null>(null);
  const resolvedAnchorHashRef = useRef<string | null>(null);
  const tableIdentityRecordsRef = useRef<TableIdentityRecord[] | null>(null);
  if (tableIdentityRecordsRef.current === null) {
    tableIdentityRecordsRef.current = readPersistedTableIdentities();
  }

  useLayoutEffect(() => {
    markMarkdownPhase('markdown-react-commit');
    const syncTableIdentities = () => {
      const root = rootRef.current;
      if (!root) return;

      const persisted = readPersistedTableIdentities();
      if (persisted.length > 0) {
        tableIdentityRecordsRef.current = persisted;
      }

      const tables = Array.from(
        root.querySelectorAll<HTMLTableElement>('.feishu-table__scrollport > table'),
      );
      if (tables.length === 0) return;
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
        const table = tables.find(
          (candidate) => candidate.dataset.feishuTableId === record.currentId,
        );
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

    if (lastTableIdentitySyncKeyRef.current !== visibleTableIdentitySyncKey) {
      lastTableIdentitySyncKeyRef.current = visibleTableIdentitySyncKey;
      syncTableIdentities();
    }
    const anchorHash = typeof window !== 'undefined' ? window.location.hash : '';
    if (anchorHash !== initialAnchorHashRef.current) {
      initialAnchorHashRef.current = anchorHash;
      resolvedAnchorHashRef.current = null;
    }
    const root = rootRef.current;
    window.dispatchEvent(new Event(MARKDOWN_HEADINGS_CHANGED_EVENT));
    if (root && anchorHash && resolvedAnchorHashRef.current !== anchorHash) {
      if (scrollToAnchor(root, anchorHash)) {
        resolvedAnchorHashRef.current = anchorHash;
      }
    }

    window.addEventListener('feishu-table-identities-updated', syncTableIdentities);
    return () => window.removeEventListener('feishu-table-identities-updated', syncTableIdentities);
  }, [committedBatchCount, model, visibleTableIdentitySyncKey]);

  const hasRemainingBatches = model.strategy === 'progressive'
    && committedBatchCount < model.batches.length;

  useEffect(() => {
    if (model.strategy !== 'progressive' || !hasRemainingBatches) return undefined;

    const targetBatchIndex = (() => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const targetId = decodeAnchorHash(hash);
      const hashBatchIndex = targetId ? findHeadingBatchIndex(model, targetId) : null;
      const requestedBatchIndex = requestedHeading
        ? findHeadingBatchIndex(model, requestedHeading.id, requestedHeading.text)
        : null;
      const indexes = [hashBatchIndex, requestedBatchIndex]
        .filter((index): index is number => index !== null);
      return indexes.length > 0 ? Math.max(...indexes) : null;
    })();
    const shouldLoadForAnchor = targetBatchIndex !== null
      && targetBatchIndex >= committedBatchCount;

    const loadNextBatch = () => {
      const nextBatchIndex = committedBatchCount;
      if (nextBatchIndex >= model.batches.length) return;
      schedulerRef.current?.schedule(() => {
        const nextMap = new Map(progressiveMapRef.current);
        const batchEndIndex = shouldLoadForAnchor && targetBatchIndex !== null
          ? Math.min(
            targetBatchIndex,
            nextBatchIndex + MARKDOWN_NAVIGATION_BATCHES_PER_TURN - 1,
          )
          : nextBatchIndex;
        for (let batchIndex = nextBatchIndex; batchIndex <= batchEndIndex; batchIndex += 1) {
          const renderedBatch = renderMarkdownBlocks(
            model.batches[batchIndex] ?? [],
            sourceContext,
            model.metadata,
            nextMap,
            model.batchMermaidOffsets[batchIndex] ?? 0,
          );
          renderedBatch.forEach((rendered, key) => nextMap.set(key, rendered));
        }
        const reachedNavigationTarget = shouldLoadForAnchor
          && targetBatchIndex !== null
          && batchEndIndex >= targetBatchIndex;
        const nextVisibleBatchStartIndex = reachedNavigationTarget
          ? Math.max(0, targetBatchIndex - 1)
          : visibleBatchStartIndex;
        const nextVisibleBatchEndIndex = reachedNavigationTarget
          ? Math.min(model.batches.length, targetBatchIndex + 1)
          : Math.max(visibleBatchEndIndex, batchEndIndex + 1);
        const nextRenderedByKey = reachedNavigationTarget
          ? selectRenderedBatches(
            nextMap,
            model.batches,
            nextVisibleBatchStartIndex,
            nextVisibleBatchEndIndex,
          )
          : nextMap;
        progressiveMapRef.current = nextRenderedByKey;
        renderedCacheRef.current = limitReusableRenderedBlocks(nextRenderedByKey);
        if (previousModelRef.current?.modelKey === model.modelKey) {
          previousModelRef.current = {
            ...previousModelRef.current,
            renderedByKey: limitReusableRenderedBlocks(nextRenderedByKey),
          };
        }
        setProgressiveState({
          modelKey: model.modelKey,
          renderedByKey: nextRenderedByKey,
          committedBatchCount: Math.min(model.batches.length, batchEndIndex + 1),
          visibleBatchStartIndex: nextVisibleBatchStartIndex,
          visibleBatchEndIndex: nextVisibleBatchEndIndex,
        });
      });
    };

    if (shouldLoadForAnchor || typeof IntersectionObserver === 'undefined') {
      loadNextBatch();
      return undefined;
    }

    const placeholder = progressivePlaceholderRef.current;
    if (!placeholder) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadNextBatch();
      }
    }, { root: null, rootMargin: '800px 0px', threshold: 0.01 });
    observer.observe(placeholder);
    return () => observer.disconnect();
  }, [committedBatchCount, hasRemainingBatches, model, requestedHeading, sourceContext, visibleBatchEndIndex, visibleBatchStartIndex]);

  useEffect(() => {
    if (model.strategy !== 'progressive' || visibleBatchStartIndex <= 0) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const placeholder = progressiveTopPlaceholderRef.current;
    if (!placeholder) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      schedulerRef.current?.schedule(() => {
        setProgressiveState((current) => {
          if (current.modelKey !== model.modelKey || current.visibleBatchStartIndex <= 0) return current;
          const nextVisibleBatchStartIndex = Math.max(0, current.visibleBatchStartIndex - 1);
          const nextMap = new Map(current.renderedByKey);
          const renderedBatch = renderMarkdownBlocks(
            model.batches[nextVisibleBatchStartIndex] ?? [],
            sourceContext,
            model.metadata,
            nextMap,
            model.batchMermaidOffsets[nextVisibleBatchStartIndex] ?? 0,
          );
          renderedBatch.forEach((rendered, key) => nextMap.set(key, rendered));
          progressiveMapRef.current = nextMap;
          renderedCacheRef.current = limitReusableRenderedBlocks(nextMap);
          return {
            ...current,
            renderedByKey: nextMap,
            visibleBatchStartIndex: nextVisibleBatchStartIndex,
          };
        });
      });
    }, { root: null, rootMargin: '800px 0px', threshold: 0.01 });
    observer.observe(placeholder);
    return () => observer.disconnect();
  }, [model, sourceContext, visibleBatchStartIndex]);

  useEffect(() => {
    if (!requestedHeading) return;
    const root = rootRef.current;
    if (!root) return;
    const target = Array.from(root.querySelectorAll<HTMLElement>('[id]'))
      .find((element) => element.id === requestedHeading.id
        || element.id === `user-content-${requestedHeading.id}`
        || (element.matches('h1,h2,h3,h4,h5,h6')
          && element.querySelector('.feishu-heading__text')?.textContent?.trim() === requestedHeading.text));
    if (!target) return;

    window.dispatchEvent(new CustomEvent(MARKDOWN_HEADING_READY_EVENT, {
      detail: { id: requestedHeading.id },
    }));
    lastResolvedHeadingRef.current = requestedHeading;
    setRequestedHeading(null);
  }, [committedBatchCount, model, requestedHeading]);

  return (
    <ImagePreviewProvider>
      <DocumentSearch containerRef={rootRef} contentVersion={searchContentVersion} />
      <div ref={rootRef} className="feishu-markdown-body">
        {model.fullRendered
          ? <div data-feishu-block-key="full-document">{model.fullRendered}</div>
          : model.strategy === 'progressive'
            ? (
              <>
                {visibleBatchStartIndex > 0 && (
                  <div
                    ref={progressiveTopPlaceholderRef}
                    className="feishu-markdown-progressive-placeholder feishu-markdown-progressive-placeholder--top"
                    data-feishu-progressive-top-placeholder
                    aria-hidden="true"
                    style={{ minHeight: `${getLeadingPlaceholderHeight(model.batches, visibleBatchStartIndex)}px` }}
                  />
                )}
                {model.batches.slice(visibleBatchStartIndex, visibleBatchEndIndex).map((batch) => (
                  <div
                    className="feishu-markdown-batch"
                    key={batch[0]?.renderKey ?? 'empty-batch'}
                    style={{ containIntrinsicSize: `0 ${getBatchEstimatedHeight(batch)}px` }}
                  >
                    {batch.map((block) => (
                      <MarkdownBlockView
                        key={block.renderKey}
                        block={block}
                        metadata={model.metadata}
                        rendered={activeRenderedByKey.get(block.renderKey)}
                        sourceContext={sourceContext}
                      />
                    ))}
                  </div>
                ))}
              </>
            )
            : model.blocks.map((block) => (
              <MarkdownBlockView
                key={block.renderKey}
                block={block}
                metadata={model.metadata}
                rendered={activeRenderedByKey.get(block.renderKey)}
                sourceContext={sourceContext}
              />
            ))}
        {hasRemainingBatches && visibleBatchEndIndex < model.batches.length && (
          <div
            ref={progressivePlaceholderRef}
            className="feishu-markdown-progressive-placeholder"
            data-feishu-progressive-placeholder
            aria-hidden="true"
            style={{ minHeight: `${model.remainingPlaceholderHeights[committedBatchCount] ?? 240}px` }}
          />
        )}
      </div>
    </ImagePreviewProvider>
  );
}
