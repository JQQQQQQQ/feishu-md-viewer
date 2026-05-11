async page => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return await page.evaluate(() => Boolean(document.querySelector('#feishu-md-viewer-host')));
}
