import {
  useCallback,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Check, Copy } from 'lucide-react';
import { MermaidBlock } from '../MermaidBlock';
import { MermaidToolbar } from '../../Mermaid/MermaidToolbar';
import { DotBlock } from '../DotBlock';
import { highlightCode } from './highlighter';

let mermaidIndex = 0;

export function resetMermaidRenderCounter() {
  mermaidIndex = 0;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may not be available in some contexts
    }
  }, [text]);

  return (
    <button
      className="feishu-code-block__copy-btn"
      onClick={() => void handleCopy()}
      type="button"
      aria-label={copied ? '已复制' : '复制代码'}
    >
      {copied ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={2} aria-hidden="true" />}
      <span>{copied ? '已复制' : '复制'}</span>
    </button>
  );
}

export function FeishuCodeBlock({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  const childElement = children as { props?: { className?: string; children?: string } } | undefined;
  const lang = (childElement?.props?.className ?? '')
    .replace(/^language-/, '')
    .trim()
    .toLowerCase();
  const code = childElement?.props?.children ?? '';

  if (lang === 'mermaid' && typeof code === 'string') {
    const idx = mermaidIndex++;
    return (
      <MermaidToolbar code={code} blockIndex={idx}>
        <MermaidBlock code={code} index={idx} />
      </MermaidToolbar>
    );
  }

  const isDotLanguage = lang === 'dot' || lang === 'graphviz' || lang === 'gv';
  if (isDotLanguage && typeof code === 'string') {
    const idx = mermaidIndex++;
    return <DotBlock code={code} index={idx} />;
  }

  const codeText = typeof code === 'string' ? code : '';

  return (
    <div className="feishu-code-block">
      <div className="feishu-code-block__tools">
        {lang && <span className="feishu-code-block__lang">{lang}</span>}
        {codeText && <CopyButton text={codeText} />}
      </div>
      <pre className={`feishu-code-block__pre ${className ?? ''}`} {...props}>
        <code className={`feishu-code-block__code ${lang ? `language-${lang}` : ''}`}>
          {codeText ? highlightCode(codeText, lang) : children}
        </code>
      </pre>
    </div>
  );
}
