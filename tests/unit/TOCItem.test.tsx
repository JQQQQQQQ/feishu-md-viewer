import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TOCItem } from '@/viewer/components/TOC/TOCItem';
import type { TOCItem as TOCItemType } from '@/viewer/hooks/useTOC';

function createItem(overrides: Partial<TOCItemType> = {}): TOCItemType {
  return {
    id: 'test-heading',
    text: 'Test Heading',
    level: 2,
    children: [],
    ...overrides,
  };
}

describe('TOCItem', () => {
  it('renders item text', () => {
    const item = createItem({ text: 'Introduction' });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={vi.fn()} />
      </ul>
    );
    expect(screen.getByText('Introduction')).toBeDefined();
  });

  it('shows active state class when activeId matches', () => {
    const item = createItem({ id: 'my-heading' });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="my-heading" onNavigate={vi.fn()} />
      </ul>
    );
    const link = screen.getByRole('link');
    expect(link.classList.contains('feishu-toc__link--active')).toBe(true);
  });

  it('has aria-selected=true when active', () => {
    const item = createItem({ id: 'active-item' });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="active-item" onNavigate={vi.fn()} />
      </ul>
    );
    const treeitem = screen.getByRole('treeitem');
    expect(treeitem.getAttribute('aria-selected')).toBe('true');
  });

  it('has aria-expanded attribute when item has children', () => {
    const item = createItem({
      children: [createItem({ id: 'child-1', text: 'Child 1', level: 3 })],
    });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={vi.fn()} />
      </ul>
    );
    const treeitems = screen.getAllByRole('treeitem');
    // First treeitem is the parent with children
    expect(treeitems[0].hasAttribute('aria-expanded')).toBe(true);
  });

  it('does not have aria-expanded attribute when item has no children', () => {
    const item = createItem({ children: [] });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={vi.fn()} />
      </ul>
    );
    const treeitem = screen.getByRole('treeitem');
    expect(treeitem.hasAttribute('aria-expanded')).toBe(false);
  });

  it('calls onNavigate when clicked', () => {
    const onNavigate = vi.fn();
    const item = createItem({ id: 'click-target' });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={onNavigate} />
      </ul>
    );
    const link = screen.getByRole('link');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('click-target');
  });

  it('calls onNavigate on Enter key press', () => {
    const onNavigate = vi.fn();
    const item = createItem({ id: 'enter-target' });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={onNavigate} />
      </ul>
    );
    const link = screen.getByRole('link');
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('enter-target');
  });

  it('toggles expanded state on ArrowRight/ArrowLeft keys', () => {
    const item = createItem({
      children: [createItem({ id: 'child-1', text: 'Child 1', level: 3 })],
    });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={vi.fn()} />
      </ul>
    );
    const treeitems = screen.getAllByRole('treeitem');
    const treeitem = treeitems[0];
    const links = screen.getAllByRole('link');
    const link = links[0];

    // Initially expanded (default state is true)
    expect(treeitem.getAttribute('aria-expanded')).toBe('true');

    // ArrowLeft should collapse
    fireEvent.keyDown(link, { key: 'ArrowLeft' });
    expect(treeitem.getAttribute('aria-expanded')).toBe('false');

    // ArrowRight should expand
    fireEvent.keyDown(link, { key: 'ArrowRight' });
    expect(treeitem.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders children when expanded', () => {
    const item = createItem({
      children: [
        createItem({ id: 'child-a', text: 'Child A', level: 3 }),
        createItem({ id: 'child-b', text: 'Child B', level: 3 }),
      ],
    });
    render(
      <ul role="tree">
        <TOCItem item={item} activeId="" onNavigate={vi.fn()} />
      </ul>
    );
    // Children should be rendered (expanded by default)
    expect(screen.getByText('Child A')).toBeDefined();
    expect(screen.getByText('Child B')).toBeDefined();
  });
});
