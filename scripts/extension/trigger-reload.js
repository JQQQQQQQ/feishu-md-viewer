async page => {
  const source = 'feishu-md-viewer-devtools';
  const requestId = String(Date.now());

  let target = page;
  for (const candidate of page.context().pages()) {
    if (candidate.url().startsWith('chrome-extension://')) continue;
    try {
      if (await candidate.locator('#feishu-md-viewer-host').count()) {
        target = candidate;
        break;
      }
    } catch {
      // 标签页可能在切换过程中关闭，继续检查其他候选页。
    }
  }

  await target.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 5000 });

  const result = await target.evaluate(({ source, requestId }) => new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      resolve({ success: false, error: 'Timed out waiting for extension reload acknowledgement.' });
    }, 5000);

    function handleMessage(event) {
      const data = event.data;
      if (
        data?.source === source &&
        data?.type === 'RELOAD_EXTENSION_ACK' &&
        data?.requestId === requestId
      ) {
        window.clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        resolve(data);
      }
    }

    window.addEventListener('message', handleMessage);
    window.postMessage({ source, type: 'RELOAD_EXTENSION', requestId }, '*');
  }), { source, requestId });

  await target.waitForTimeout(1200);
  await target.reload({ waitUntil: 'domcontentloaded' });
  await target.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });
  return { ...result, url: target.url() };
}
