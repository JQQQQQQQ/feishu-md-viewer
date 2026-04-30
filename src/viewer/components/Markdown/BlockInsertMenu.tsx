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
  { label: '标题 1', icon: 'H1', markdown: '\n# \n', group: 'heading' },
  { label: '标题 2', icon: 'H2', markdown: '\n## \n', group: 'heading' },
  { label: '标题 3', icon: 'H3', markdown: '\n### \n', group: 'heading' },
  { label: '代码块', icon: '</>', markdown: '\n```\n\n```\n', group: 'block' },
  { label: '表格', icon: '[]', markdown: '\n| Column 1 | Column 2 |\n|---|---|\n| Cell | Cell |\n', group: 'block' },
  { label: '分割线', icon: '---', markdown: '\n---\n', group: 'block' },
  { label: '引用', icon: '>', markdown: '\n> \n', group: 'block' },
  { label: '无序列表', icon: '*', markdown: '\n- \n', group: 'list' },
  { label: '有序列表', icon: '1.', markdown: '\n1. \n', group: 'list' },
  { label: '任务列表', icon: '[]', markdown: '\n- [ ] \n', group: 'list' },
  { label: 'Mermaid 图表', icon: 'M', markdown: '\n```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n', group: 'advanced' },
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
