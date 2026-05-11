async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';
  const source = 'feishu-md-viewer-devtools';
  const requestId = String(Date.now());

  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });

  const result = await page.evaluate(({ source, requestId }) => new Promise((resolve) => {
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

  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });
  return result;
}
