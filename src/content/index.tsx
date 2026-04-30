import { getActiveAdapter } from './adapters';
import { injectViewerContainer, injectStyles } from './injector';
import { createRoot } from 'react-dom/client';
import { App } from '../viewer/App';
import feishuTheme from '../viewer/styles/feishu-theme.css?inline';
import markdownStyles from '../viewer/styles/markdown.css?inline';
import layoutStyles from '../viewer/styles/layout.css?inline';
import editorStyles from '../viewer/styles/editor.css?inline';
import saveStatusStyles from '../viewer/styles/save-status.css?inline';
import tailwindStyles from '../viewer/styles/tailwind-output.css?inline';
import darkThemeStyles from '../viewer/styles/dark-theme.css?inline';
import printStyles from '../viewer/styles/print.css?inline';
import wysiwygStyles from '../viewer/styles/wysiwyg.css?inline';
import nordThemeStyles from '@milkdown/theme-nord/style.css?raw';

async function main(): Promise<void> {
  const adapter = getActiveAdapter();
  if (!adapter) return;

  const content = await adapter.getContent();
  if (!content) return;

  const source = adapter.name as 'file' | 'github' | 'gitlab';

  const { shadowRoot, mountPoint } = injectViewerContainer();

  injectStyles(shadowRoot, tailwindStyles);
  injectStyles(shadowRoot, feishuTheme);
  injectStyles(shadowRoot, markdownStyles);
  injectStyles(shadowRoot, layoutStyles);
  injectStyles(shadowRoot, editorStyles);
  injectStyles(shadowRoot, saveStatusStyles);
  injectStyles(shadowRoot, darkThemeStyles);
  injectStyles(shadowRoot, printStyles);
  injectStyles(shadowRoot, nordThemeStyles);
  injectStyles(shadowRoot, wysiwygStyles);

  const root = createRoot(mountPoint);
  root.render(<App markdown={content} source={source} />);
}

main();
