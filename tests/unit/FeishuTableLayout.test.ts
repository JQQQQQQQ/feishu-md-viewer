import { describe, expect, it } from 'vitest';
import { getTableLayoutMode, updateTableWideWidth } from '@/viewer/components/Markdown/FeishuTableLayout';

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

describe('FeishuTableLayout', () => {
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
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1168px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');

    updateTableWideWidth(wrapper, 'balanced');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1270px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('-102px');
  });

  it('uses the parent content box when sections add indentation padding', () => {
    const wrapper = createWrapper(150, 900, 16, 8);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    });

    updateTableWideWidth(wrapper, 'right');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1152px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('0px');

    updateTableWideWidth(wrapper, 'balanced');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1270px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('-118px');
  });

  it('centers balanced tables inside the main content viewport instead of the whole window', () => {
    const wrapper = createWrapper(691, 710, 0, 0, 277);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1745,
    });

    updateTableWideWidth(wrapper, 'balanced');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-width')).toBe('1320px');
    expect(wrapper.style.getPropertyValue('--feishu-table-wide-offset')).toBe('-340px');
  });
});
