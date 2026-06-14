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

/**
 * Stubs `window.matchMedia` (absent in jsdom) so `useInstallPrompt`'s
 * `detectStandalone()` -- `window.matchMedia?.('(display-mode: standalone)')`
 * -- can be evaluated. `standalone` controls whether the
 * '(display-mode: standalone)' query matches.
 */
function stubMatchMedia(standalone: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && standalone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/**
 * DESIGN.md 10.4: when no `beforeinstallprompt` has fired (canInstall is
 * false) and the app is not standalone, LaunchScreen shows the manual
 * "How to install" fallback rather than an enabled "Install app" button.
 * When `(display-mode: standalone)` matches, neither is shown.
 */
describe('LaunchScreen install fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('shows the manual install fallback when not standalone and no install prompt was captured', async () => {
    vi.stubEnv('VITE_DEPLOY_MODE', 'platform');
    stubMatchMedia(false);
    // iOS standalone detection also feeds detectStandalone(); ensure it's false.
    Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true });

    const { LaunchScreen } = await import('../../src/app/screens/LaunchScreen.js');
    render(<LaunchScreen {...baseState()} />);

    // Source: LaunchScreen.tsx -- `<summary>How to install</summary>` inside
    // the `!install.dismissed` branch of the `!install.isStandalone` section.
    expect(screen.getByText('How to install')).toBeInTheDocument();

    // Source: LaunchScreen.tsx -- the captured-prompt branch's button text.
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('shows neither install action when running in standalone display mode', async () => {
    vi.stubEnv('VITE_DEPLOY_MODE', 'platform');
    stubMatchMedia(true);
    Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true });

    const { LaunchScreen } = await import('../../src/app/screens/LaunchScreen.js');
    render(<LaunchScreen {...baseState()} />);

    // Source: LaunchScreen.tsx -- `{!install.isStandalone ? (<>... <h2 id="install-heading">Install this app</h2> ...) : null}`.
    expect(screen.queryByText('Install this app')).not.toBeInTheDocument();
    expect(screen.queryByText('How to install')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
