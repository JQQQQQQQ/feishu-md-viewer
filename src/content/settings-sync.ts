import type { LocalFileRefreshMode } from '../viewer/store';

export interface ViewerSettingsSyncPatch {
  localFileRefreshMode?: LocalFileRefreshMode;
  sidebarDividerVisible?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Extracts only settings that the already-mounted content page can apply live. */
export function getViewerSettingsSyncPatch(value: unknown): ViewerSettingsSyncPatch {
  if (!isRecord(value)) return {};

  const patch: ViewerSettingsSyncPatch = {};
  if (Object.prototype.hasOwnProperty.call(value, 'localFileRefreshMode')) {
    patch.localFileRefreshMode = value.localFileRefreshMode === 'auto' ? 'auto' : 'prompt';
  }
  if (Object.prototype.hasOwnProperty.call(value, 'sidebarDividerVisible')) {
    patch.sidebarDividerVisible = value.sidebarDividerVisible !== false;
  }
  return patch;
}
