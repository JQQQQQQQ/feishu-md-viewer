import { beforeEach, describe, expect, it } from 'vitest';
import { useViewerStore } from '@/viewer/store/index';

describe('Preview lock mode', () => {
  beforeEach(() => {
    useViewerStore.setState({
      mode: 'read',
      previewLockEnabled: false,
      tocSmoothScrollEnabled: true,
    });
  });

  it('blocks switching to edit or source when preview lock is enabled', () => {
    useViewerStore.getState().setPreviewLockEnabled(true);

    useViewerStore.getState().setMode('edit');
    expect(useViewerStore.getState().mode).toBe('read');

    useViewerStore.getState().setMode('source');
    expect(useViewerStore.getState().mode).toBe('read');
  });

  it('forces read mode when lock is enabled from editing mode', () => {
    useViewerStore.setState({ mode: 'edit', previewLockEnabled: false, tocSmoothScrollEnabled: true });

    useViewerStore.getState().setPreviewLockEnabled(true);

    expect(useViewerStore.getState().mode).toBe('read');
  });

  it('allows editing again after preview lock is disabled', () => {
    useViewerStore.getState().setPreviewLockEnabled(true);
    useViewerStore.getState().setPreviewLockEnabled(false);

    useViewerStore.getState().setMode('edit');
    expect(useViewerStore.getState().mode).toBe('edit');
  });
});
