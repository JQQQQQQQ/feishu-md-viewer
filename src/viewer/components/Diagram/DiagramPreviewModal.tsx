import { MermaidPreviewModal } from '../Mermaid/MermaidPreviewModal';

interface DiagramPreviewModalProps {
  svg: string;
  title: string;
  onClose: () => void;
  sanitizeSvg: (svg: string) => string;
}

/** 通用图表全屏预览入口，交互由现有 Mermaid 预览画布统一承载。 */
export function DiagramPreviewModal({
  svg,
  title,
  onClose,
  sanitizeSvg,
}: DiagramPreviewModalProps) {
  return (
    <MermaidPreviewModal
      svg={svg}
      onClose={onClose}
      title={title}
      ariaLabel={`${title}`}
      closeLabel="× 退出"
      sanitizeSvg={sanitizeSvg}
    />
  );
}
