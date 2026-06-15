import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import type { CapturePack } from '../../src/engine/index.js';
import type { StoredPack, WolfAppState } from '../../src/app/hooks/useWolfApp.js';

const pack = genericPackJson as unknown as CapturePack;

const storedPack: StoredPack = {
  packId: pack.packId,
  packVersion: pack.packVersion,
  digest: 'sha256-test-digest',
  trust: 'bundled',
  installedAt: '2024-01-01T00:00:00.000Z',
  pack,
};

function baseState(overrides: Partial<WolfAppState> = {}): WolfAppState {
  return {
    db: null,
    packs: [storedPack],
    records: [],
    loading: false,
    error: null,
    refreshRecords: vi.fn(),
    refreshPacks: vi.fn(),
    migrationSummary: null,
    ...overrides,
  };
}

// `src/app/config.ts` derives `appConfig` from `import.meta.env` at module
// load time (DESIGN.md 9.4). To exercise both deployment modes we stub the
// env vars *before* importing the module graph, and `vi.resetModules()`
// between cases so each import re-evaluates `readAppConfig()` against the
// freshly stubbed env. `LaunchScreen` itself imports `appConfig` (not
// `readAppConfig`), so this is the only way to flip its rendered mode
// without changing the component's props.
describe('LaunchScreen', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the platform-mode title and full pack list by default', async () => {
    vi.stubEnv('VITE_DEPLOY_MODE', 'platform');

    const { LaunchScreen } = await import('../../src/app/screens/LaunchScreen.js');
    const { appConfig } = await import('../../src/app/config.js');

    expect(appConfig.deployMode).toBe('platform');

    render(<LaunchScreen {...baseState()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'AXM Wolf' })).toBeInTheDocument();
    expect(
      screen.getByText('A local-first place to capture institutional knowledge, one answer at a time.'),
    ).toBeInTheDocument();

    // Derived counts come from the pack data, not hard-coded strings.
    const sectionCount = pack.sections.length;
    const promptCount = pack.prompts.length;
    expect(
      screen.getByText(
        new RegExp(`${sectionCount} sections? .* ${promptCount} prompts?`),
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 3, name: pack.title })).toBeInTheDocument();
  });

  it('renders single-pack mode framed around the bundled pack', async () => {
    vi.stubEnv('VITE_DEPLOY_MODE', 'single-pack');
    vi.stubEnv('VITE_DEFAULT_PACK_ID', pack.packId);

    const { LaunchScreen } = await import('../../src/app/screens/LaunchScreen.js');
    const { appConfig } = await import('../../src/app/config.js');

    expect(appConfig.deployMode).toBe('single-pack');
    expect(appConfig.defaultPackId).toBe(pack.packId);

    render(<LaunchScreen {...baseState()} />);

    // In single-pack mode the title is the pack's own title, not "AXM Wolf".
    expect(screen.getByRole('heading', { level: 1, name: pack.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'AXM Wolf' })).not.toBeInTheDocument();

    if (pack.subtitle) {
      // The subtitle can appear in more than one place (header + pack card),
      // so assert presence with getAllByText rather than the single-match getByText.
      expect(screen.getAllByText(pack.subtitle).length).toBeGreaterThan(0);
    }

    // The generic platform-mode tagline is not shown in single-pack mode.
    expect(
      screen.queryByText('A local-first place to capture institutional knowledge, one answer at a time.'),
    ).not.toBeInTheDocument();
  });
});
