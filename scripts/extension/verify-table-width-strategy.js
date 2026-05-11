async page => {
  await page.goto('https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, {
    timeout: 20000,
  });
  await page.waitForTimeout(1200);

  return await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const viewportWidth = window.innerWidth;
    const contentRect = root.querySelector('.feishu-viewer__content')?.getBoundingClientRect();

    function getHeading(wrapper) {
      let node = wrapper;
      while (node) {
        let prev = node.previousElementSibling;
        while (prev) {
          const heading = prev.matches?.('.feishu-heading')
            ? prev
            : prev.querySelector?.('.feishu-heading');
          if (heading?.textContent?.trim()) return heading.textContent.trim();
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }
      return '';
    }

    return Array.from(root.querySelectorAll('.feishu-table-wrapper')).map((wrapper, index) => {
      const table = wrapper.querySelector('.feishu-table');
      const rect = wrapper.getBoundingClientRect();
      const parentRect = wrapper.parentElement?.getBoundingClientRect();
      const parentStyle = wrapper.parentElement ? getComputedStyle(wrapper.parentElement) : null;
      const parentContentLeft = parentRect && parentStyle
        ? parentRect.left + (parseFloat(parentStyle.paddingLeft) || 0)
        : null;
      const columnCount = table
        ? Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0)
        : 0;
      const mode = wrapper.classList.contains('feishu-table-wrapper--wide-balanced')
        ? 'balanced'
        : wrapper.classList.contains('feishu-table-wrapper--wide-right')
          ? 'right'
          : 'normal';

      return {
        index,
        heading: getHeading(wrapper),
        columnCount,
        mode,
        className: wrapper.className,
        contentWidth: contentRect ? Math.round(contentRect.width) : null,
        parentContentLeft: parentContentLeft === null ? null : Math.round(parentContentLeft),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        viewportWidth,
        leftGutter: Math.round(rect.left),
        rightGutter: Math.round(viewportWidth - rect.right),
        overflowLeft: rect.left < -1,
        overflowRight: rect.right > viewportWidth + 1,
        cssWidth: getComputedStyle(wrapper).width,
        cssWideWidth: wrapper.style.getPropertyValue('--feishu-table-wide-width'),
        cssWideOffset: wrapper.style.getPropertyValue('--feishu-table-wide-offset'),
      };
    }).filter((item) => (
      item.heading.includes('Table') ||
      item.heading.includes('Expansion') ||
      item.heading.includes('Columns')
    ));
  });
}
