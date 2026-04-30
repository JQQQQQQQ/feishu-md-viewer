import { useState, useCallback, type KeyboardEvent } from 'react';
import type { TOCItem as TOCItemType } from '../../hooks/useTOC';

interface TOCItemProps {
  item: TOCItemType;
  activeId: string;
  onNavigate: (id: string) => void;
}

export function TOCItem({ item, activeId, onNavigate }: TOCItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isActive = activeId === item.id;
  const hasChildren = item.children.length > 0;

  const handleClick = useCallback(() => {
    onNavigate(item.id);
  }, [item.id, onNavigate]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(item.id);
    } else if (e.key === 'ArrowRight' && hasChildren && !expanded) {
      e.preventDefault();
      setExpanded(true);
    } else if (e.key === 'ArrowLeft' && hasChildren && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  }, [item.id, onNavigate, hasChildren, expanded]);

  return (
    <li className="feishu-toc__item" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`feishu-toc__link ${isActive ? 'feishu-toc__link--active' : ''}`}
        style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="link"
        aria-current={isActive ? 'true' : undefined}
      >
        {hasChildren && (
          <button
            className={`feishu-toc__toggle ${expanded ? 'feishu-toc__toggle--expanded' : ''}`}
            onClick={handleToggle}
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        )}
        <span className="feishu-toc__text">{item.text}</span>
      </div>
      {hasChildren && expanded && (
        <ul className="feishu-toc__children" role="group">
          {item.children.map((child) => (
            <TOCItem key={child.id} item={child} activeId={activeId} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
