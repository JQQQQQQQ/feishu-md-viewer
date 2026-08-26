interface ContentUpdateNoticeProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function ContentUpdateNotice({ onRefresh, isRefreshing = false }: ContentUpdateNoticeProps) {
  return (
    <div className="feishu-content-update-notice" role="status" aria-live="polite">
      <span>Markdown 文件已更新</span>
      <button type="button" onClick={onRefresh} disabled={isRefreshing}>
        {isRefreshing ? '刷新中…' : '立即刷新'}
      </button>
    </div>
  );
}
