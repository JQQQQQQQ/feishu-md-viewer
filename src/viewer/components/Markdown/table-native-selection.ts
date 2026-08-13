export function hasNativeTextSelection(wrapper: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString()) return false;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  return Boolean(
    anchorNode
    && focusNode
    && wrapper.contains(anchorNode)
    && wrapper.contains(focusNode),
  );
}
