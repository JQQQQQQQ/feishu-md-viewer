import { describe, expect, it } from 'vitest';
import { getTableContentOffset, getTableLayoutMode, getTableRailDragScrollDelta, getTableResizeScrollTarget, resolveTableLayoutMode, resolveTableScrollPresentation, updateTableWideWidth } from '@/viewer/components/Markdown/FeishuTableLayout';

function createTable(columnCount: number, cellTexts?: string[]): HTMLTableElement {
  const table = document.createElement('table');
  const row = table.insertRow();

  Array.from({ length: columnCount }).forEach((_, index) => {
    row.insertCell().textContent = cellTexts?.[index] ?? `Cell ${index + 1}`;
  });

  return table;
}

function createWrapper(
  parentLeft: number,
  parentWidth: number,
  paddingLeft = 0,
  paddingRight = 0,
  mainLeft?: number
): HTMLElement {
  const main = document.createElement('main');
  const parent = document.createElement('div');
  const wrapper = document.createElement('div');

  main.className = 'feishu-app-shell__main';
  parent.style.paddingLeft = `${paddingLeft}px`;
  parent.style.paddingRight = `${paddingRight}px`;
  main.appendChild(parent);
  parent.appendChild(wrapper);
  main.getBoundingClientRect = () => ({
    x: mainLeft ?? 0,
    y: 0,
    top: 0,
    left: mainLeft ?? 0,
    right: 1366,
    bottom: 0,
    width: 1366 - (mainLeft ?? 0),
    height: 0,
    toJSON: () => '',
  });
  parent.getBoundingClientRect = () => ({
    x: parentLeft,
    y: 0,
    top: 0,
    left: parentLeft,
    right: parentLeft + parentWidth,
    bottom: 0,
    width: parentWidth,
    height: 0,
    toJSON: () => '',
  });
  wrapper.getBoundingClientRect = () => ({
    x: parentLeft,
    y: 0,
    top: 0,
    left: parentLeft,
    right: parentLeft + parentWidth,
    bottom: 0,
    width: parentWidth,
    height: 0,
    toJSON: () => '',
  });

  return wrapper;
}

function mockHorizontalMetrics(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  metrics: {
    clientWidth: number;
    wrapperScrollWidth: number;
    tableScrollWidth: number;
  },
): void {
  Object.defineProperty(wrapper, 'clientWidth', {
    configurable: true,
    get: () => metrics.clientWidth,
  });
  Object.defineProperty(wrapper, 'scrollWidth', {
    configurable: true,
    get: () => metrics.wrapperScrollWidth,
  });
  Object.defineProperty(table, 'scrollWidth', {
    configurable: true,
    get: () => metrics.tableScrollWidth,
  });
}

describe('FeishuTableLayout', () => {
  it('splits horizontal scroll into left reveal and the fixed scrollport remainder', () => {
    expect(resolveTableScrollPresentation(10, 200, 1366)).toEqual({
      leftReveal: 10,
      mainScrollLeft: 0,
    });
    const presentation = resolveTableScrollPresentation(100, 200, 1366);
    expect(presentation.leftReveal).toBeCloseTo(63.4);
    expect(presentation.mainScrollLeft).toBeCloseTo(36.6);
    expect(presentation.leftReveal + presentation.mainScrollLeft).toBe(100);
  });

  it('preserves the complete fractional scroll distance just beyond the left reveal limit', () => {
    const scrollLeft = 63.400001;
    const presentation = resolveTableScrollPresentation(scrollLeft, 200, 1366);

    expect(presentation.leftReveal).toBe(200 - 1366 * 0.1);
    expect(presentation.mainScrollLeft).toBe(scrollLeft - presentation.leftReveal);
    expect(presentation.leftReveal + presentation.mainScrollLeft).toBe(scrollLeft);
  });

  it('does not produce a negative left reveal when the table begins inside the left gutter', () => {
    expect(resolveTableScrollPresentation(24, 80, 1366)).toEqual({
      leftReveal: 0,
      mainScrollLeft: 24,
    });
  });

  it('compensates table content only until the left reading gutter without resizing the frame', () => {
    expect(getTableContentOffset(10, 150, 1366)).toBe(10);
    expect(getTableContentOffset(80, 150, 1366)).toBeCloseTo(13.4);
    expect(getTableContentOffset(0, 150, 1366)).toBe(0);
  });
  it('auto-scrolls the table while resizing at either edge', () => {
    expect(getTableResizeScrollTarget(498, { left: 100, right: 500 }, 0, 1600, 800)).toBe(800);
    expect(getTableResizeScrollTarget(101, { left: 100, right: 500 }, 800, 1600, 800)).toBe(0);
    expect(getTableResizeScrollTarget(300, { left: 100, right: 500 }, 0, 1600, 800)).toBeNull();
  });

  it('returns a bounded incremental scroll delta for a column-rail drag at either edge', () => {
    expect(getTableRailDragScrollDelta(498, { left: 100, right: 500 }, 0, 1600, 800)).toBeGreaterThan(0);
    expect(getTableRailDragScrollDelta(101, { left: 100, right: 500 }, 800, 1600, 800)).toBeLessThan(0);
    expect(getTableRailDragScrollDelta(300, { left: 100, right: 500 }, 200, 1600, 800)).toBe(0);
    expect(getTableRailDragScrollDelta(498, { left: 100, right: 500 }, 800, 1600, 800)).toBe(0);
    expect(getTableRailDragScrollDelta(101, { left: 100, right: 500 }, 0, 1600, 800)).toBe(0);
  });
  it('keeps compact tables in the normal reading width', () => {
    expect(getTableLayoutMode(createTable(2))).toBe('normal');
    expect(getTableLayoutMode(createTable(3))).toBe('normal');
  });

  it('keeps short four-column tables in the normal reading width', () => {
    expect(getTableLayoutMode(createTable(4, ['Name', 'Owner', 'State', 'Date']))).toBe('normal');
  });

  it('expands content-heavy four-column tables to the right', () => {
    const table = createTable(4, [
      'RMSDataSync_ThirtyMinute_Timer',
      'RMS Azure Function',
      'Scans Dataverse entity changes and sends sync messages',
      '/root/workspace/intl-retail/front/src/main/java/com/mi/info/intl/DataSync.cs',
    ]);

    expect(getTableLayoutMode(table)).toBe('right');
  });

  it('expands medium-wide tables to the right first', () => {
    expect(getTableLayoutMode(createTable(6))).toBe('right');
    expect(getTableLayoutMode(createTable(8))).toBe('right');
  });

  it('uses balanced expansion only for very wide tables', () => {
    expect(getTableLayoutMode(createTable(9))).toBe('balanced');
    expect(getTableLayoutMode(createTable(12))).toBe('balanced');
  });

  it('keeps right and balanced wide tables inside the same viewport gutter', () => {
    const wrapper = createWrapper(150, 900);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'right');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1079px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');

    updateTableWideWidth(wrapper, 'balanced');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1079px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('uses the parent content box when sections add indentation padding', () => {
    const wrapper = createWrapper(150, 900, 16, 8);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'right');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1063px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');

    updateTableWideWidth(wrapper, 'balanced');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1063px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('centers balanced tables inside the main content viewport instead of the whole window', () => {
    const wrapper = createWrapper(691, 710, 0, 0, 277);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1745,
    });

    updateTableWideWidth(wrapper, 'balanced');
    const width = Number.parseFloat(wrapper.style.getPropertyValue('--feishu-table-wide-width'));
    expect(width).toBe(879);
    expect(691 + width).toBeLessThanOrEqual(1745 * 0.9);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('bounds balanced width from the real wrapper left edge when it differs from the main start', () => {
    const wrapper = createWrapper(640, 720, 0, 0, 240);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });

    updateTableWideWidth(wrapper, 'balanced', 1800);

    const width = Number.parseFloat(wrapper.style.getPropertyValue('--feishu-table-wide-width'));
    expect(width).toBe(800);
    expect(640 + width).toBeLessThanOrEqual(1600 * 0.9);
  });

  it('keeps balanced expansion bounded even when table content is wider', () => {
    const wrapper = createWrapper(150, 900);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'balanced', 980);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('980px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');

    updateTableWideWidth(wrapper, 'balanced', 1480);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1079px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('keeps the right-wide outer frame bounded while content scrolls inside', () => {
    const wrapper = createWrapper(150, 900);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'right', 1185);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1079px');

    updateTableWideWidth(wrapper, 'right', 760);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('760px');
  });

  it('keeps the balanced frame inside the right boundary after the directory hides', () => {
    const wrapper = createWrapper(150, 900);
    const main = wrapper.closest('.feishu-app-shell__main');
    main?.classList.add('feishu-app-shell__main--table-scrolling');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });

    updateTableWideWidth(wrapper, 'balanced', 1600);

    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1079px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('clamps balanced width from its actual left edge', () => {
    const wrapper = createWrapper(280, 900);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'balanced', 2000);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('949px');
    expect(280 + 949).toBeLessThanOrEqual(1366 * 0.9 + 0.5);
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');
  });

  it('upgrades right expansion to balanced when right expansion still overflows', () => {
    const wrapper = createWrapper(150, 900);
    const table = createTable(6);
    wrapper.appendChild(table);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    mockHorizontalMetrics(wrapper, table, {
      clientWidth: 1168,
      wrapperScrollWidth: 1240,
      tableScrollWidth: 1240,
    });

    expect(resolveTableLayoutMode(wrapper, table, 'right')).toBe('balanced');
    expect(wrapper.classList.contains('feishu-table-wrapper--wide-right')).toBe(false);
    expect(wrapper.classList.contains('feishu-table-wrapper--wide-balanced')).toBe(false);
  });

  it('keeps right expansion when right expansion can avoid horizontal overflow', () => {
    const wrapper = createWrapper(150, 900);
    const table = createTable(6);
    wrapper.appendChild(table);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    mockHorizontalMetrics(wrapper, table, {
      clientWidth: 1168,
      wrapperScrollWidth: 1168,
      tableScrollWidth: 1168,
    });

    expect(resolveTableLayoutMode(wrapper, table, 'right')).toBe('right');
    expect(wrapper.classList.contains('feishu-table-wrapper--wide-right')).toBe(false);
    expect(wrapper.classList.contains('feishu-table-wrapper--wide-balanced')).toBe(false);
  });
});
