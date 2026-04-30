import type { PlatformAdapter } from '@/shared/types/adapter';
import { FileAdapter } from './file-adapter';
import { GitHubAdapter } from './github-adapter';
import { GitLabAdapter } from './gitlab-adapter';

export { FileAdapter } from './file-adapter';
export { GitHubAdapter } from './github-adapter';
export { GitLabAdapter } from './gitlab-adapter';

/**
 * All registered platform adapters in priority order.
 * file:// is checked first as it's the most specific match.
 */
const adapters: PlatformAdapter[] = [
  new FileAdapter(),
  new GitHubAdapter(),
  new GitLabAdapter(),
];

/**
 * Tries each registered adapter and returns the first one whose
 * detect() method returns true. Returns null if no adapter matches.
 */
export function getActiveAdapter(): PlatformAdapter | null {
  for (const adapter of adapters) {
    if (adapter.detect()) {
      return adapter;
    }
  }
  return null;
}
