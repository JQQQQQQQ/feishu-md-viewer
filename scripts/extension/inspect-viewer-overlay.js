async page => {
  return await page.evaluate(() => {
    const host = document.querySelector('#feishu-md-viewer-host');
    const root = host?.shadowRoot;
    const viewer = root?.querySelector('.feishu-viewer');
    const pageNode = root?.querySelector('.feishu-viewer__page');
    const content = root?.querySelector('.feishu-viewer__content');
    const pm = root?.querySelector('.ProseMirror');
    const info = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        position: style.position,
        zIndex: style.zIndex,
        background: style.backgroundColor,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
      };
    };

    return {
      url: location.href,
      title: document.title,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      host: info(host),
      viewer: info(viewer),
      page: info(pageNode),
      content: info(content),
      editor: info(pm),
      bodyTextSample: document.body.innerText.slice(0, 300),
      shadowTextSample: pm?.innerText.slice(0, 300) ?? '',
    };
  });
}
