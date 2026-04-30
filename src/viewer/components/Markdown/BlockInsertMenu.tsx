import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';

interface MenuItem {
  label: string;
  icon: string;
  markdown: string;
  group?: string;
}

interface BlockInsertMenuProps {
  editorContainerRef: RefObject<HTMLDivElement | null>;
  onInsert: (markdown: string) => void;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Heading 1', icon: 'H1', markdown: '\n# ', group: 'heading' },
  { label: 'Heading 2', icon: 'H2', markdown: '\n## ', group: 'heading' },
  { label: 'Heading 3', icon: 'H3', markdown: '\n### ', group: 'heading' },
  { label: 'Code Block', icon: '</>', markdown: '\n```\n\n```\n', group: 'block' },
  { label: 'Table', icon: '[]', markdown: '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| cell | cell | cell |\n', group: 'block' },
  { label: 'Divider', icon: '---', markdown: '\n---\n', group: 'block' },
  { label: 'Blockquote', icon: '>', markdown: '\n> ', group: 'block' },
  { label: 'Bullet List', icon: '*', markdown: '\n- item\n- item\n- item\n', group: 'list' },
  { label: 'Ordered List', icon: '1.', markdown: '\n1. item\n2. item\n3. item\n', group: 'list' },
  { label: 'Task List', icon: '[]', markdown: '\n- [ ] task\n- [ ] task\n', group: 'list' },
  { label: 'Mermaid Diagram', icon: 'M', markdown: '\n```mermaid\ngraph TD\n    A[Start] --> B[End]\n```\n', group: 'advanced' },
];

export function BlockInsertMenu({ editorContainerRef, onInsert }: BlockInsertMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setVisible(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;

    el.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorContainerRef, handleContextMenu, handleClickOutside, handleKeyDown]);

  const handleItemClick = useCallback(
    (item: MenuItem) => {
      onInsert(item.markdown);
      setVisible(false);
    },
    [onInsert],
  );

  if (!visible) return null;

  // Adjust position to keep menu within viewport
  const menuStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
  };

  let lastGroup: string | undefined;

  return (
    <div
      ref={menuRef}
      className="feishu-block-menu"
      style={menuStyle}
      role="menu"
      aria-label="Insert block"
    >
      {MENU_ITEMS.map((item, index) => {
        const showDivider = lastGroup !== undefined && item.group !== lastGroup;
        lastGroup = item.group;

        return (
          <div key={item.label}>
            {showDivider && (
              <div className="feishu-block-menu__divider" role="separator" />
            )}
            <button
              className="feishu-block-menu__item"
              role="menuitem"
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => { handleItemClick(item); }}
            >
              <span className="feishu-block-menu__icon">{item.icon}</span>
              <span className="feishu-block-menu__label">{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
