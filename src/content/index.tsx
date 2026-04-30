import { detectMarkdownPage, fetchGitHubRawContent, fetchGitLabRawContent } from './detector';
import { injectViewerContainer, injectStyles } from './injector';
import { createRoot } from 'react-dom/client';
import { App } from '../viewer/App';
import feishuTheme from '../viewer/styles/feishu-theme.css?inline';
import markdownStyles from '../viewer/styles/markdown.css?inline';
import layoutStyles from '../viewer/styles/layout.css?inline';
import editorStyles from '../viewer/styles/editor.css?inline';
import saveStatusStyles from '../viewer/styles/save-status.css?inline';
import tailwindStyles from '../viewer/styles/tailwind-output.css?inline';

async function main(): Promise<void> {
  const detection = detectMarkdownPage();
  if (!detection.isMarkdown || !detection.source) return;

  let content = detection.rawContent;

  if (!content && detection.source === 'github') {
    content = await fetchGitHubRawContent();
  }
  if (!content && detection.source === 'gitlab') {
    content = await fetchGitLabRawContent();
  }
  if (!content) return;

  const { shadowRoot, mountPoint } = injectViewerContainer();

  injectStyles(shadowRoot, tailwindStyles);
  injectStyles(shadowRoot, feishuTheme);
  injectStyles(shadowRoot, markdownStyles);
  injectStyles(shadowRoot, layoutStyles);
  injectStyles(shadowRoot, editorStyles);
  injectStyles(shadowRoot, saveStatusStyles);

  const root = createRoot(mountPoint);
  root.render(<App markdown={content} source={detection.source} />);
}

main();
