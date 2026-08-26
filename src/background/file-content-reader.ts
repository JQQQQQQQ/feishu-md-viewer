export type FileFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Reads a local Markdown URL from the extension context. Keeping this helper
 * in the background bundle gives file:// access a second chance when a page
 * content script is restricted by the page's origin.
 */
export async function readLocalFileContent(
  url: string,
  fetchImpl: FileFetch = fetch,
): Promise<string | null> {
  if (!url.startsWith('file://')) return null;

  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
