import { renderMermaid } from '../../../../lib/mermaid-init';
import { sanitizeMermaidSvg } from '../../../utils/sanitize-svg';

export const MERMAID_PREVIEW_EVENT = 'feishu-open-mermaid-preview';

function setMermaidWidgetLoading(container: HTMLElement): void {
  container.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'feishu-editor-mermaid-widget__loading';
  loading.textContent = 'Rendering Mermaid...';
  container.appendChild(loading);
}

function setMermaidWidgetError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const error = document.createElement('div');
  error.className = 'feishu-editor-mermaid-widget__error';

  const title = document.createElement('strong');
  title.textContent = 'Mermaid error';
  const detail = document.createElement('span');
  detail.textContent = message;

  error.append(title, detail);
  container.appendChild(error);
}

function setMermaidWidgetSvg(container: HTMLElement, svg: string): void {
  container.innerHTML = '';
  const diagram = document.createElement('div');
  diagram.className = 'feishu-editor-mermaid-widget__diagram';
  diagram.innerHTML = svg;
  container.appendChild(diagram);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportMermaidPng(svg: string, filename: string): void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const image = new Image();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  image.onload = () => {
    const scale = 2;
    canvas.width = Math.max(1, image.naturalWidth * scale);
    canvas.height = Math.max(1, image.naturalHeight * scale);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      if (pngBlob) downloadBlob(pngBlob, filename);
    }, 'image/png');
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

function copyMermaidSource(code: string, button: HTMLButtonElement): void {
  void navigator.clipboard?.writeText(code).then(() => {
    const previousLabel = button.textContent;
    button.textContent = '已复制';
    window.setTimeout(() => {
      button.textContent = previousLabel;
    }, 1600);
  });
}

function createMermaidButton(label: string, action: () => void, modifier?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `feishu-editor-mermaid-widget__button${modifier ? ` ${modifier}` : ''}`;
  button.textContent = label;
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  });
  return button;
}

export function createMermaidWidget(code: string, pos: number, editEventName: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'feishu-editor-mermaid-widget';
  let currentSvg: string | null = null;

  const toolbar = document.createElement('div');
  toolbar.className = 'feishu-editor-mermaid-widget__toolbar';

  const openPreview = () => {
    if (!currentSvg) return;
    window.dispatchEvent(new CustomEvent(MERMAID_PREVIEW_EVENT, {
      detail: { svg: currentSvg },
    }));
  };

  const exportSvg = () => {
    if (!currentSvg) return;
    downloadBlob(
      new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' }),
      `mermaid-diagram-${pos}.svg`,
    );
  };

  const exportPng = () => {
    if (!currentSvg) return;
    exportMermaidPng(currentSvg, `mermaid-diagram-${pos}.png`);
  };

  const copySource = (button: HTMLButtonElement) => {
    copyMermaidSource(code, button);
  };

  const editSource = () => {
    wrapper.dispatchEvent(new CustomEvent(editEventName, {
      bubbles: true,
      detail: { pos },
    }));
  };

  const body = document.createElement('div');
  body.className = 'feishu-editor-mermaid-widget__body';
  const copySourceButton = createMermaidButton('复制源码', () => copySource(copySourceButton));
  toolbar.append(
    createMermaidButton('预览', openPreview),
    copySourceButton,
    createMermaidButton('SVG', exportSvg),
    createMermaidButton('PNG', exportPng),
    createMermaidButton('编辑源码', editSource, 'feishu-editor-mermaid-widget__button--edit'),
  );
  wrapper.append(toolbar, body);
  setMermaidWidgetLoading(body);

  void renderMermaid(code, `editor-mermaid-${pos}-${Date.now()}`)
    .then((svg) => {
      currentSvg = sanitizeMermaidSvg(svg);
      setMermaidWidgetSvg(body, currentSvg);
    })
    .catch((error: unknown) => {
      setMermaidWidgetError(body, error instanceof Error ? error.message : String(error));
    });

  return wrapper;
}
