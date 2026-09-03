import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { FeishuTable } from '@/viewer/components/Markdown/FeishuTable';
import { setTableColumnWidthsBridge } from '@/viewer/components/Markdown/FeishuTableColumnWidths';

function TableHarness() {
  return (
    <FeishuTable>
      <thead>
        <tr>
          <th>H1</th>
          <th>H2</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td />
          <td />
        </tr>
        <tr>
          <td />
          <td />
        </tr>
      </tbody>
    </FeishuTable>
  );
}

function WideTableHarness() {
  return (
    <FeishuTable>
      <thead><tr><th>H1</th><th>H2</th><th>H3</th></tr></thead>
      <tbody><tr><td /><td /><td /></tr></tbody>
    </FeishuTable>
  );
}

function MergedTableHarness() {
  return (
    <FeishuTable>
      <caption>项目进度总览</caption>
      <thead>
        <tr><th rowSpan={2}>项目</th><th colSpan={2}>进度</th></tr>
        <tr><th>负责人</th><th>状态</th></tr>
      </thead>
      <tbody>
        <tr><td rowSpan={2}>Markdown 预览</td><td>小 Q</td><td>已完成</td></tr>
        <tr><td colSpan={2}>后续进行 GitHub README 兼容性验收</td></tr>
      </tbody>
    </FeishuTable>
  );
}

function readSelectedDataRows(table: HTMLTableElement): Array<{ row: number; selectedCells: number }> {
  return Array.from(table.rows)
    .map((tr, row) => ({
      row,
      selectedCells: tr.querySelectorAll('td.feishu-table__cell--selected').length,
    }))
    .filter((item) => item.selectedCells > 0);
}

function getSourceTable(container: HTMLElement): HTMLTableElement {
  const table = container.querySelector('.feishu-table__scrollport > table.feishu-table');
  if (!(table instanceof HTMLTableElement)) {
    throw new Error('Source table is missing.');
  }
  return table;
}

function revealLeftTable(container: HTMLElement): HTMLTableElement {
  const wrapper = container.querySelector('.feishu-table-wrapper');
  const scrollport = container.querySelector('.feishu-table__scrollport');
  const leftRevealTable = container.querySelector('.feishu-table--left-reveal-clone');
  if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement) || !(leftRevealTable instanceof HTMLTableElement)) {
    throw new Error('Left reveal table is missing.');
  }

  wrapper.getBoundingClientRect = () => ({
    x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
    toJSON: () => '',
  });
  Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
  Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
  Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
  fireEvent.scroll(scrollport);

  return leftRevealTable;
}

describe('FeishuTable selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a fixed native scrollport and a mouse-selectable left reveal layer', () => {
    const { container } = render(<TableHarness />);

    const scrollport = container.querySelector('.feishu-table__scrollport');
    const leftReveal = container.querySelector('.feishu-table__left-reveal');
    const stickyHead = container.querySelector('.feishu-table__sticky-head');
    const stickyLeftReveal = container.querySelector('.feishu-table__sticky-left-reveal');

    expect(scrollport).toBeInstanceOf(HTMLElement);
    expect(leftReveal).toBeInstanceOf(HTMLElement);
    expect(leftReveal?.getAttribute('aria-hidden')).toBe('true');
    expect(leftReveal?.hasAttribute('inert')).toBe(false);
    expect(stickyHead?.getAttribute('aria-hidden')).toBe('true');
    expect(stickyHead?.hasAttribute('inert')).toBe(true);
    expect(stickyLeftReveal?.getAttribute('aria-hidden')).toBe('true');
    expect(stickyLeftReveal?.hasAttribute('inert')).toBe(true);
  });

  it('floats the table caption and every merged header row as one block', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const { container } = render(<MergedTableHarness />);
    const table = getSourceTable(container);
    const wrapper = container.querySelector('.feishu-table-wrapper') as HTMLElement;
    const scrollport = container.querySelector('.feishu-table__scrollport') as HTMLElement;
    const head = table.tHead as HTMLTableSectionElement;
    const caption = table.caption as HTMLTableCaptionElement;
    const stickyHead = container.querySelector('.feishu-table__sticky-head') as HTMLElement;
    const stickyTable = container.querySelector('.feishu-table__sticky-head > table') as HTMLTableElement;
    const stickyLeftRevealTable = container.querySelector('.feishu-table__sticky-left-reveal > table') as HTMLTableElement;

    wrapper.getBoundingClientRect = () => ({
      x: 300, y: 0, top: 0, left: 300, right: 800, bottom: 600, width: 500, height: 600,
      toJSON: () => '',
    });
    table.getBoundingClientRect = () => ({
      x: 300, y: 0, top: 0, left: 300, right: 1200, bottom: 600, width: 900, height: 600,
      toJSON: () => '',
    });
    scrollport.getBoundingClientRect = wrapper.getBoundingClientRect;
    head.getBoundingClientRect = () => ({
      x: 300, y: 0, top: 0, left: 300, right: 1200, bottom: 72, width: 900, height: 72,
      toJSON: () => '',
    });
    caption.getBoundingClientRect = () => ({
      x: 300, y: 0, top: 0, left: 300, right: 1200, bottom: 28, width: 900, height: 28,
      toJSON: () => '',
    });
    Array.from(head.rows).forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        x: 300, y: index * 36, top: index * 36, left: 300, right: 1200,
        bottom: (index + 1) * 36, width: 900, height: 36,
        toJSON: () => '',
      });
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });

    fireEvent.scroll(scrollport);
    frames.splice(0).forEach((callback) => callback(0));

    expect(stickyTable.caption?.textContent).toBe('项目进度总览');
    expect(stickyTable.tHead?.rows).toHaveLength(2);
    expect(stickyTable.querySelectorAll(':scope > colgroup > col')).toHaveLength(3);
    expect(stickyLeftRevealTable.caption?.textContent).toBe('项目进度总览');
    expect(stickyHead.style.display).toBe('block');
    expect(stickyHead.style.height).toBe('100px');
  });

  it('removes descendant IDs from readonly and sticky clones', () => {
    const { container } = render(
      <FeishuTable id="source-table">
        <thead id="source-head">
          <tr><th id="source-header-cell">Header</th></tr>
        </thead>
        <tbody><tr><td id="source-body-cell">Value</td></tr></tbody>
      </FeishuTable>,
    );

    expect(container.querySelectorAll('#source-table')).toHaveLength(1);
    expect(container.querySelectorAll('#source-head')).toHaveLength(1);
    expect(container.querySelectorAll('#source-header-cell')).toHaveLength(1);
    expect(container.querySelectorAll('#source-body-cell')).toHaveLength(1);
  });

  it('keeps the left reveal clone empty until a positive reveal is needed', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    const leftReveal = container.querySelector('.feishu-table__left-reveal');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    expect(leftReveal).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    expect(leftReveal?.querySelectorAll('th,td')).toHaveLength(0);
    expect(leftReveal?.textContent).toBe('');

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });

    fireEvent.scroll(scrollport);

    expect(leftReveal?.querySelectorAll('th')).toHaveLength(2);
    expect(leftReveal?.querySelectorAll('td')).toHaveLength(4);
    expect(leftReveal?.textContent).toContain('H1');
  });

  it('extends the table caption into the left reveal without hiding its text', () => {
    const { container } = render(
      <FeishuTable>
        <caption>项目进度总览</caption>
        <thead><tr><th>项目</th><th>状态</th></tr></thead>
        <tbody><tr><td>Markdown</td><td>已完成</td></tr></tbody>
      </FeishuTable>,
    );
    const sourceTable = getSourceTable(container);
    const leftRevealTable = revealLeftTable(container);

    expect(sourceTable.querySelector('caption')?.textContent).toBe('项目进度总览');
    const leftRevealCaption = leftRevealTable.querySelector('caption');
    expect(leftRevealCaption?.textContent).toBe('项目进度总览');
    expect(leftRevealCaption?.classList.contains('feishu-table__caption--left-reveal-spacer')).toBe(false);
    expect(leftRevealCaption?.getAttribute('aria-hidden')).toBeNull();
  });

  it('selects the final logical column when dragging across a merged header row', () => {
    const { container } = render(<MergedTableHarness />);
    const table = getSourceTable(container);
    const ownerCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const statusCell = table.rows[1]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(ownerCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseOver(statusCell, { clientX: 300, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(ownerCell.classList.contains('feishu-table__header--selected')).toBe(true);
    expect(statusCell.classList.contains('feishu-table__header--selected')).toBe(true);
  });

  it('extends a cell drag through the full width of a merged destination cell', () => {
    const { container } = render(<MergedTableHarness />);
    const table = getSourceTable(container);
    const ownerCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const statusCell = table.rows[1]?.cells[1] as HTMLTableCellElement;
    const mergedBodyCell = table.rows[3]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(ownerCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseOver(mergedBodyCell, { clientX: 300, clientY: 220 });
    fireEvent.mouseUp(document);

    expect(ownerCell.classList.contains('feishu-table__header--selected')).toBe(true);
    expect(statusCell.classList.contains('feishu-table__header--selected')).toBe(true);
  });

  it('maps a left reveal cell click to the corresponding source cell selection', () => {
    const { container } = render(<TableHarness />);
    const sourceTable = getSourceTable(container);
    const leftRevealTable = revealLeftTable(container);
    const leftCell = leftRevealTable.rows[1]?.cells[1] as HTMLTableCellElement;
    const sourceCell = sourceTable.rows[1]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(leftCell, { button: 0, clientX: 40, clientY: 40 });

    expect(sourceCell.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(leftCell.classList.contains('feishu-table__cell--selected')).toBe(false);
  });

  it('extends the source range while dragging across left reveal cells', () => {
    const { container } = render(<TableHarness />);
    const sourceTable = getSourceTable(container);
    const leftRevealTable = revealLeftTable(container);
    const firstLeftCell = leftRevealTable.rows[1]?.cells[0] as HTMLTableCellElement;
    const lastLeftCell = leftRevealTable.rows[2]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(firstLeftCell, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseOver(lastLeftCell, { clientX: 160, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(readSelectedDataRows(sourceTable)).toEqual([
      { row: 1, selectedCells: 2 },
      { row: 2, selectedCells: 2 },
    ]);
  });

  it('maps a left reveal header click to only its corresponding source header cell', () => {
    const { container } = render(<TableHarness />);
    const sourceTable = getSourceTable(container);
    const leftRevealTable = revealLeftTable(container);
    const leftHeader = leftRevealTable.rows[0]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(leftHeader, { button: 0, clientX: 40, clientY: 40 });

    expect(sourceTable.rows[0]?.cells[0].classList.contains('feishu-table__header--selected')).toBe(true);
    expect(sourceTable.rows[1]?.cells[0].classList.contains('feishu-table__cell--selected')).toBe(false);
    expect(sourceTable.rows[2]?.cells[0].classList.contains('feishu-table__cell--selected')).toBe(false);
    expect(sourceTable.rows[1]?.cells[1].classList.contains('feishu-table__cell--selected')).toBe(false);
  });

  it('keeps selection on one row during horizontal drag with minor vertical jitter', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const otherRowCell = table.rows[2]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 180, clientY: 102 });
    fireEvent.mouseOver(otherRowCell, { clientX: 180, clientY: 102 });
    fireEvent.mouseUp(document, { clientX: 180, clientY: 102 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]?.selectedCells).toBe(2);
  });

  it('reveals 10px on the left while keeping the native scrollport and outer frame fixed', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.style.width = '500px';
    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(scrollport, 'offsetHeight', { configurable: true, value: 220 });
    Object.defineProperty(scrollport, 'clientHeight', { configurable: true, value: 203 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(scrollport);

    expect(wrapper.style.width).toBe('500px');
    expect(wrapper.clientWidth).toBe(500);
    expect(scrollport.clientWidth).toBe(500);
    expect(wrapper.style.getPropertyValue('--feishu-table-left-reveal')).toBe('10px');
    expect(wrapper.style.getPropertyValue('--feishu-table-scrollbar-height')).toBe('17px');
    expect(wrapper.classList.contains('feishu-table-wrapper--left-revealed')).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toMatchObject({
      active: true,
      leftReveal: 10,
      maxScrollLeft: 400,
    });
  });

  it('布局触发的滚动同步只更新表格视觉，不收起目录', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    try {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent.scroll(scrollport);

      expect(wrapper.style.getPropertyValue('--feishu-table-left-reveal')).toBe('10px');
      expect(events).toHaveLength(0);
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        delete (document as { visibilityState?: unknown }).visibilityState;
      }
    }
  });

  it('页面可见时只要原生 scrollLeft 发生变化就收起目录', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) {
      throw new Error('Table harness is incomplete.');
    }

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(scrollport);

    expect(events.at(-1)?.detail).toMatchObject({ active: true, leftReveal: 10 });
  });

  it('clears the left reveal and sidebar signal after scrolling back or losing overflow', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 24, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(scrollport);
    expect(events.at(-1)?.detail).toMatchObject({ active: true, leftReveal: 24 });

    scrollport.scrollLeft = 0;
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 500 });
    fireEvent.scroll(scrollport);

    expect(wrapper.style.getPropertyValue('--feishu-table-left-reveal')).toBe('0px');
    expect(wrapper.classList.contains('feishu-table-wrapper--left-revealed')).toBe(false);
    expect(events.at(-1)?.detail).toMatchObject({
      active: false,
      leftReveal: 0,
      maxScrollLeft: 0,
    });
  });

  it('离开垂直可视范围时清除该表的目录隐藏来源', () => {
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
    let intersectionCallback: IntersectionObserverCallback | undefined;
    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [0];
    }

    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: FakeIntersectionObserver,
    });

    try {
      const { container } = render(<TableHarness />);
      const wrapper = container.querySelector('.feishu-table-wrapper');
      const scrollport = container.querySelector('.feishu-table__scrollport');
      expect(wrapper).toBeInstanceOf(HTMLElement);
      expect(scrollport).toBeInstanceOf(HTMLElement);
      if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

      wrapper.getBoundingClientRect = () => ({
        x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
        toJSON: () => '',
      });
      Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 24, writable: true });
      Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
      Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
      const events: CustomEvent[] = [];
      wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
        events.push(event as CustomEvent);
      });

      fireEvent.scroll(scrollport);
      expect(events.at(-1)?.detail).toMatchObject({ active: true, leftReveal: 24 });
      expect(intersectionCallback).toBeTypeOf('function');

      intersectionCallback?.([
        {
          target: wrapper,
          isIntersecting: false,
          intersectionRatio: 0,
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);

      expect(events.at(-1)?.detail).toMatchObject({
        active: false,
        leftReveal: 0,
        scrollLeft: 0,
      });
    } finally {
      if (originalIntersectionObserver) {
        Object.defineProperty(globalThis, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
      }
    }
  });

  it('caps the visual reveal while preserving the native scroll distance beyond the cap', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 100, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });

    fireEvent.scroll(scrollport);

    expect(scrollport.scrollLeft).toBe(100);
    expect(Number.parseFloat(wrapper.style.getPropertyValue('--feishu-table-left-reveal'))).toBeCloseTo(63.4);
    expect(Number.parseFloat(wrapper.style.getPropertyValue('--feishu-table-left-reveal-content-offset'))).toBeCloseTo(36.6);
    expect(wrapper.style.getPropertyValue('--feishu-table-native-scroll-left')).toBe('100px');
  });

  it('auto-scrolls a cell-range drag at the horizontal edge and extends into newly revealed cells', () => {
    const { container } = render(<WideTableHarness />);
    const scrollport = container.querySelector('.feishu-table__scrollport');
    const table = getSourceTable(container);
    const cells = table.querySelectorAll<HTMLTableCellElement>('tbody td');
    expect(scrollport).toBeInstanceOf(HTMLElement);
    expect(cells).toHaveLength(3);
    if (!(scrollport instanceof HTMLElement) || !cells[0] || !cells[2]) return;

    scrollport.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => cells[2]),
    });

    fireEvent.mouseDown(cells[0], { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(document, { clientX: 498, clientY: 80 });

    expect(scrollport.scrollLeft).toBeGreaterThan(0);
    expect(cells[0].classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(cells[2].classList.contains('feishu-table__cell--selected')).toBe(true);

    fireEvent.mouseUp(document);
  });

  it('shows edge-scroll affordances only for directions with hidden table content', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });

    fireEvent.scroll(scrollport);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-left')).toBe(false);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-right')).toBe(true);

    scrollport.scrollLeft = 100;
    fireEvent.scroll(scrollport);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-left')).toBe(true);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-right')).toBe(true);

    scrollport.scrollLeft = 400;
    fireEvent.scroll(scrollport);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-left')).toBe(true);
    expect(wrapper.classList.contains('feishu-table-wrapper--can-scroll-right')).toBe(false);
  });

  it('treats even a subpixel left reveal as an active directory-hiding signal', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper');
    const scrollport = container.querySelector('.feishu-table__scrollport');
    expect(wrapper).toBeInstanceOf(HTMLElement);
    expect(scrollport).toBeInstanceOf(HTMLElement);
    if (!(wrapper instanceof HTMLElement) || !(scrollport instanceof HTMLElement)) return;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0.5, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    wrapper.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(scrollport);

    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toMatchObject({
      active: true,
      leftReveal: 0.5,
    });
    expect(events[0]?.detail.scrollLeft).toBeGreaterThan(8);
    expect(events[0]?.detail.sourceId).toMatch(/^feishu-table-/);
  });

  it('keeps the directory hidden until every revealed table has rolled back', () => {
    const { container } = render(
      <>
        <TableHarness />
        <TableHarness />
      </>,
    );
    const wrappers = Array.from(container.querySelectorAll('.feishu-table-wrapper')) as HTMLElement[];
    const scrollports = Array.from(container.querySelectorAll('.feishu-table__scrollport')) as HTMLElement[];
    const firstWrapper = wrappers[0];
    const secondWrapper = wrappers[1];
    const firstScrollport = scrollports[0];
    const secondScrollport = scrollports[1];
    if (!firstWrapper || !secondWrapper || !firstScrollport || !secondScrollport) {
      throw new Error('Table harness is incomplete.');
    }

    firstWrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(firstScrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(firstScrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(firstScrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(secondScrollport, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(secondScrollport, 'scrollWidth', { configurable: true, value: 500 });
    Object.defineProperty(secondScrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    container.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(firstScrollport);
    fireEvent.scroll(secondScrollport);

    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toMatchObject({ active: true, leftReveal: 10 });

    secondWrapper.getBoundingClientRect = firstWrapper.getBoundingClientRect;
    Object.defineProperty(secondScrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(secondScrollport, 'scrollWidth', { configurable: true, value: 900 });
    fireEvent.scroll(secondScrollport);

    expect(events).toHaveLength(2);
    expect(events[1]?.detail).toMatchObject({ active: true });
    expect(events[1]?.detail.revealedSourceIds).toHaveLength(2);

    secondScrollport.scrollLeft = 0;
    fireEvent.scroll(secondScrollport);
    expect(events).toHaveLength(3);
    expect(events[2]?.detail).toMatchObject({ active: true, leftReveal: 10 });
    expect(events[2]?.detail.revealedSourceIds).toHaveLength(1);

    firstScrollport.scrollLeft = 0;
    fireEvent.scroll(firstScrollport);
    expect(events).toHaveLength(4);
    expect(events[3]?.detail).toMatchObject({ active: false, leftReveal: 0 });
    expect(events[3]?.detail.revealedSourceIds).toEqual([]);
  });

  it('keeps the directory hidden when one of two revealed tables unmounts', () => {
    const renderTables = (showFirst: boolean, showSecond: boolean) => (
      <>
        {showFirst ? <TableHarness key="first" /> : null}
        {showSecond ? <TableHarness key="second" /> : null}
      </>
    );
    const { container, rerender } = render(renderTables(true, true));
    const wrappers = Array.from(container.querySelectorAll('.feishu-table-wrapper')) as HTMLElement[];
    const scrollports = Array.from(container.querySelectorAll('.feishu-table__scrollport')) as HTMLElement[];
    const sourceTables = Array.from(container.querySelectorAll('.feishu-table__scrollport > table')) as HTMLTableElement[];
    if (wrappers.length !== 2 || scrollports.length !== 2 || sourceTables.length !== 2) {
      throw new Error('Table harness is incomplete.');
    }

    wrappers.forEach((wrapper) => {
      wrapper.getBoundingClientRect = () => ({
        x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
        toJSON: () => '',
      });
    });
    scrollports.forEach((scrollport) => {
      Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
      Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
      Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    });
    sourceTables.forEach((table) => {
      Object.defineProperty(table, 'scrollWidth', { configurable: true, value: 900 });
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    const events: CustomEvent[] = [];
    container.addEventListener('feishu-table-horizontal-scroll', (event) => {
      events.push(event as CustomEvent);
    });

    fireEvent.scroll(scrollports[0]);
    fireEvent.scroll(scrollports[1]);
    expect(events).toHaveLength(2);
    expect(events[1]?.detail).toMatchObject({ active: true });
    expect(events[1]?.detail.revealedSourceIds).toHaveLength(2);

    rerender(renderTables(true, false));
    expect(events).toHaveLength(3);
    expect(events[2]?.detail).toMatchObject({ active: true, leftReveal: 10 });
    expect(events[2]?.detail.revealedSourceIds).toHaveLength(1);

    rerender(renderTables(false, false));
    expect(events).toHaveLength(4);
    expect(events[3]?.detail).toMatchObject({ active: false, leftReveal: 0 });
  });

  it('supports diagonal drag to select a rectangular block', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const otherRowCell = table.rows[2]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 220, clientY: 136 });
    fireEvent.mouseOver(otherRowCell, { clientX: 220, clientY: 136 });
    fireEvent.mouseUp(document, { clientX: 220, clientY: 136 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(2);
    expect(selectedRows[0]?.selectedCells).toBe(2);
    expect(selectedRows[1]?.selectedCells).toBe(2);
  });

  it('still allows multi-row selection for vertical-dominant drag', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    const secondRowCell = table.rows[2]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 112, clientY: 140 });
    fireEvent.mouseOver(secondRowCell, { clientX: 112, clientY: 140 });
    fireEvent.mouseUp(document, { clientX: 112, clientY: 140 });

    const selectedRows = readSelectedDataRows(table);
    expect(selectedRows).toHaveLength(2);
    expect(selectedRows[0]?.selectedCells).toBe(1);
    expect(selectedRows[1]?.selectedCells).toBe(1);
  });

  it('selects a whole column or row by clicking the outer border rail', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const columnRail = container.querySelectorAll('.feishu-table__selection-rail--top .feishu-table__selection-rail-segment');
    const rowRail = container.querySelectorAll('.feishu-table__selection-rail--left .feishu-table__selection-rail-segment');

    expect(columnRail).toHaveLength(2);
    expect(rowRail).toHaveLength(3);

    fireEvent.mouseDown(columnRail[1]);
    expect(table.rows[0]?.cells[1]?.classList.contains('feishu-table__header--selected')).toBe(true);
    expect(table.rows[1]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(columnRail[1]?.classList.contains('is-selected')).toBe(true);

    fireEvent.mouseDown(rowRail[2]);
    expect(table.rows[2]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(rowRail[2]?.classList.contains('is-selected')).toBe(true);
  });

  it('does not highlight row or column rails for a normal cell selection', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });

    expect(container.querySelectorAll('.feishu-table__selection-rail-segment.is-selected')).toHaveLength(0);
  });

  it('extends a column selection while dragging across top border rails', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const rails = container.querySelectorAll('.feishu-table__selection-rail--top .feishu-table__selection-rail-segment');

    fireEvent.mouseDown(rails[0]);
    fireEvent.mouseEnter(rails[1]);
    fireEvent.mouseUp(document);

    expect(table.rows[0]?.cells[0]?.classList.contains('feishu-table__header--selected')).toBe(true);
    expect(table.rows[0]?.cells[1]?.classList.contains('feishu-table__header--selected')).toBe(true);
    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[1]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(rails[0]?.classList.contains('is-selected')).toBe(true);
    expect(rails[1]?.classList.contains('is-selected')).toBe(true);
  });

  it('auto-scrolls the native scrollport while a column rail is dragged at its right edge', () => {
    const { container } = render(<TableHarness />);
    const scrollport = container.querySelector('.feishu-table__scrollport') as HTMLDivElement;
    const rails = container.querySelectorAll('.feishu-table__selection-rail--top .feishu-table__selection-rail-segment');
    scrollport.getBoundingClientRect = () => ({
      x: 100, y: 0, top: 0, left: 100, right: 500, bottom: 220, width: 400, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });

    fireEvent.mouseDown(rails[0]);
    fireEvent.mouseMove(document, { clientX: 498, clientY: 6 });

    expect(scrollport.scrollLeft).toBeGreaterThan(0);
    fireEvent.mouseUp(document);
  });

  it('extends a row selection while dragging across left border rails', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const rails = container.querySelectorAll('.feishu-table__selection-rail--left .feishu-table__selection-rail-segment');

    fireEvent.mouseDown(rails[2]);
    fireEvent.mouseEnter(rails[1]);
    fireEvent.mouseUp(document);

    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[1]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(rails[1]?.classList.contains('is-selected')).toBe(true);
    expect(rails[2]?.classList.contains('is-selected')).toBe(true);
  });

  it('continues column rail dragging after entering table cells', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const rails = container.querySelectorAll('.feishu-table__selection-rail--top .feishu-table__selection-rail-segment');
    const targetCell = table.rows[1]?.cells[1] as HTMLTableCellElement;

    fireEvent.mouseDown(rails[0]);
    fireEvent.mouseOver(targetCell);
    fireEvent.mouseUp(document);

    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[1]?.cells[1]?.classList.contains('feishu-table__cell--selected')).toBe(true);
  });

  it('continues row rail dragging after entering table cells', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const rails = container.querySelectorAll('.feishu-table__selection-rail--left .feishu-table__selection-rail-segment');
    const targetCell = table.rows[1]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(rails[2]);
    fireEvent.mouseOver(targetCell);
    fireEvent.mouseUp(document);

    expect(table.rows[1]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
    expect(table.rows[2]?.cells[0]?.classList.contains('feishu-table__cell--selected')).toBe(true);
  });

  it('focuses table wrapper with preventScroll to avoid viewport jump', () => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;

    fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('observes the content parent so sidebar resizing recalculates table width', () => {
    const observed: Element[] = [];
    class TestResizeObserver {
      observe(target: Element) { observed.push(target); }
      disconnect() {}
    }
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

    try {
      const { container } = render(<TableHarness />);
      const wrapper = container.querySelector('.feishu-table-wrapper');
      expect(wrapper).not.toBeNull();
      expect(observed).toContain(wrapper?.parentElement);
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  });

  it('tracks column resizing without replacing the table wide-mode layout', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper') as HTMLElement;
    const table = getSourceTable(container);
    const firstHeader = table.rows[0]?.cells[0] as HTMLTableCellElement;
    vi.spyOn(firstHeader, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 32, width: 120, height: 32,
      toJSON: () => '',
    });

    expect(wrapper.classList.contains('feishu-table-wrapper--resizing')).toBe(false);
    fireEvent.mouseDown(firstHeader, { button: 0, clientX: 118, clientY: 16 });
    expect(wrapper.classList.contains('feishu-table-wrapper--resizing')).toBe(true);

    fireEvent.mouseUp(document);
    expect(wrapper.classList.contains('feishu-table-wrapper--resizing')).toBe(false);
  });

  it('persists an in-progress resize when the webview hides before mouseup', () => {
    const write = vi.fn();
    setTableColumnWidthsBridge({ read: () => null, write });

    try {
      const { container } = render(<TableHarness />);
      const table = getSourceTable(container);
      const firstHeader = table.rows[0]?.cells[0] as HTMLTableCellElement;
      vi.spyOn(firstHeader, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 32, width: 120, height: 32,
        toJSON: () => '',
      });

      fireEvent.mouseDown(firstHeader, { button: 0, clientX: 118, clientY: 16 });
      fireEvent.mouseMove(document, { clientX: 160, clientY: 16 });
      fireEvent(window, new Event('pagehide'));

      expect(write).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([162]));
    } finally {
      setTableColumnWidthsBridge(undefined);
    }
  });

  it('auto-scrolls the native scrollport rather than the outer frame while resizing at an edge', () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper') as HTMLElement;
    const scrollport = container.querySelector('.feishu-table__scrollport') as HTMLElement;
    const table = getSourceTable(container);
    const firstHeader = table.rows[0]?.cells[0] as HTMLTableCellElement;
    vi.spyOn(firstHeader, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 32, width: 120, height: 32,
      toJSON: () => '',
    });
    scrollport.getBoundingClientRect = () => ({
      x: 100, y: 0, top: 0, left: 100, right: 500, bottom: 220, width: 400, height: 220,
      toJSON: () => '',
    });
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });

    fireEvent.mouseDown(firstHeader, { button: 0, clientX: 118, clientY: 16 });
    fireEvent.mouseMove(document, { clientX: 498, clientY: 16 });

    expect(scrollport.scrollLeft).toBe(400);
    expect(wrapper.scrollLeft).toBe(0);
    fireEvent.mouseUp(document);
  });

  it('batches repeated visible-clone refreshes into one animation frame during column resizing', async () => {
    const { container } = render(<TableHarness />);
    const wrapper = container.querySelector('.feishu-table-wrapper') as HTMLElement;
    const scrollport = container.querySelector('.feishu-table__scrollport') as HTMLElement;
    const leftRevealTable = container.querySelector('.feishu-table--left-reveal-clone') as HTMLTableElement;
    const table = getSourceTable(container);
    const firstHeader = table.rows[0]?.cells[0] as HTMLTableCellElement;

    wrapper.getBoundingClientRect = () => ({
      x: 200, y: 0, top: 0, left: 200, right: 700, bottom: 220, width: 500, height: 220,
      toJSON: () => '',
    });
    scrollport.getBoundingClientRect = wrapper.getBoundingClientRect;
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 10, writable: true });
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    vi.spyOn(firstHeader, 'getBoundingClientRect').mockReturnValue({
      x: 200, y: 0, top: 0, left: 200, right: 320, bottom: 32, width: 120, height: 32,
      toJSON: () => '',
    });

    fireEvent.scroll(scrollport);
    expect(leftRevealTable.querySelectorAll('th,td')).toHaveLength(6);

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const replaceSpy = vi.spyOn(leftRevealTable, 'replaceChildren');

    fireEvent.mouseDown(firstHeader, { button: 0, clientX: 318, clientY: 16 });
    fireEvent.mouseMove(document, { clientX: 340, clientY: 16 });
    fireEvent.mouseMove(document, { clientX: 360, clientY: 16 });
    await Promise.resolve();

    expect(replaceSpy).not.toHaveBeenCalled();
    frames.splice(0).forEach((callback) => callback(16));
    expect(replaceSpy).toHaveBeenCalledTimes(1);

    scrollport.scrollLeft = 20;
    fireEvent.scroll(scrollport);
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    fireEvent.mouseUp(document);
  });

  it('does not hijack mousedown when the pointer is on selectable cell text', () => {
    const preventDefault = vi.fn();
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const cell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    cell.textContent = 'R1C1';
    const caretSpy = vi.fn(() => ({
      commonAncestorContainer: cell.firstChild,
    } as Range));
    Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: caretSpy });

    fireEvent.mouseDown(cell, { button: 0, buttons: 1, clientX: 100, clientY: 100, preventDefault });

    expect(caretSpy).toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(readSelectedDataRows(table)).toHaveLength(0);
  });

  it('lets the browser copy a partial native text selection instead of table TSV', () => {
    const { container } = render(<TableHarness />);
    const table = getSourceTable(container);
    const cell = table.rows[1]?.cells[0] as HTMLTableCellElement;
    cell.textContent = 'R1C1';
    const text = cell.firstChild;
    if (!text) throw new Error('Cell text is missing.');

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const preventDefault = vi.fn();
    const setData = vi.fn();
    fireEvent.copy(document, { preventDefault, clipboardData: { setData } });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
  });

  it('writes HTML table clipboard data for Ctrl+C so Excel preserves the header row', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const clipboard = { write, writeText: vi.fn() };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });

    class TestClipboardItem {
      static supports() { return true; }
      types: string[];
      values: Record<string, { parts: unknown[] }>;

      constructor(values: Record<string, { parts: unknown[] }>) {
        this.values = values;
        this.types = Object.keys(values);
      }
    }
    const previousClipboardItem = globalThis.ClipboardItem;
    const previousBlob = globalThis.Blob;
    class TestBlob {
      parts: unknown[];
      type: string;

      constructor(parts: unknown[], options?: { type?: string }) {
        this.parts = parts;
        this.type = options?.type ?? '';
      }
    }
    globalThis.ClipboardItem = TestClipboardItem as unknown as typeof ClipboardItem;
    globalThis.Blob = TestBlob as unknown as typeof Blob;

    try {
      const { container } = render(<TableHarness />);
      const table = getSourceTable(container);
      const firstDataCell = table.rows[1]?.cells[0] as HTMLTableCellElement;

      fireEvent.mouseDown(firstDataCell, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

      expect(write).toHaveBeenCalledTimes(1);
      const clipboardItem = write.mock.calls[0]?.[0]?.[0] as TestClipboardItem;
      expect(clipboardItem.types).toEqual(expect.arrayContaining(['text/plain', 'text/html']));
      expect(clipboardItem.values['text/html']?.parts[0]).toContain('<thead>');
      expect(clipboardItem.values['text/html']?.parts[0]).toContain('<th scope="col"');
    } finally {
      globalThis.ClipboardItem = previousClipboardItem;
      globalThis.Blob = previousBlob;
    }
  });
});
