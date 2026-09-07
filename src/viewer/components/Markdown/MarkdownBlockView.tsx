import { cloneElement, Fragment, isValidElement, type ReactElement } from 'react';
import type { MarkdownBlock } from '../../../lib/markdown-blocks';
import {
  parseMarkdownBlock,
  type MarkdownDocumentMetadata,
} from '../../../lib/markdown-pipeline';
import type { MarkdownSourceContext } from '../../../lib/markdown-resource-resolver';

export interface MarkdownBlockViewProps {
  block: MarkdownBlock;
  sourceContext?: MarkdownSourceContext;
  metadata: MarkdownDocumentMetadata;
  rendered?: ReactElement;
}

export function MarkdownBlockView({
  block,
  sourceContext,
  metadata,
  rendered,
}: MarkdownBlockViewProps) {
  const element = rendered ?? parseMarkdownBlock(block, sourceContext, metadata);
  if (isValidElement(element) && element.type !== Fragment) {
    return cloneElement(element as ReactElement<Record<string, unknown>>, {
      'data-feishu-block-key': block.renderKey,
    });
  }

  return (
    <div className="feishu-markdown-block" data-feishu-block-key={block.renderKey}>
      {element}
    </div>
  );
}
