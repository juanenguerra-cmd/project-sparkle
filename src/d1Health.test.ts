import { describe, expect, it } from 'vitest';
import { resolveEnvTag } from '../workers/d1/d1Health';

describe('resolveEnvTag', () => {
  it('uses ENV_TAG over other values', () => {
    const envTag = resolveEnvTag(
      { ENV_TAG: 'primary', CF_PAGES_BRANCH: 'pages', NODE_ENV: 'test' },
      {}
    );
    expect(envTag).toBe('primary');
  });

  it('falls back to CF_PAGES_BRANCH', () => {
    const envTag = resolveEnvTag(
      { CF_PAGES_BRANCH: 'preview', NODE_ENV: 'test' },
      {}
    );
    expect(envTag).toBe('preview');
  });

  it('falls back to NODE_ENV', () => {
    const envTag = resolveEnvTag({ NODE_ENV: 'production' }, {});
    expect(envTag).toBe('production');
  });

  it('returns unknown when no env values exist', () => {
    const envTag = resolveEnvTag({}, {});
    expect(envTag).toBe('unknown');
  });
});
