import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PacksScreen } from '../../src/app/screens/PacksScreen.js';
import { openWolfDb } from '../../src/storage/index.js';
import type { WolfAppState } from '../../src/app/hooks/useWolfApp.js';
import { EXAMPLE_PACKS } from '../../src/app/lib/examplePacks.js';

function baseState(overrides: Partial<WolfAppState> = {}): WolfAppState {
  return {
    db: null,
    packs: [],
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
 * DESIGN.md 4.1, 4.8, 12.3: the curated "Example packs" section lists the
 * Contracting Officer's Deposition (the Wolf's Deposition is the bundled
 * default and is intentionally not duplicated here), and installing it goes
 * through the same validate-then-persist path as a file import, ending with
 * refreshPacks() and a status message.
 *
 * Drag-and-drop note: the drop zone's labeled controls and aria affordances
 * are asserted below. The drop event handler itself (dragenter/dragover/
 * dragleave/drop -> file.text() -> installFromText) is exercised manually,
 * since constructing a reliable jsdom DataTransfer/File drop is flaky and we
 * do not want to ship a flaky test.
 */
describe('PacksScreen example packs', () => {
  it('lists the curated example packs', async () => {
    const db = await openWolfDb();
    render(<PacksScreen {...baseState({ db, packs: [] })} />);

    for (const example of EXAMPLE_PACKS) {
      expect(screen.getByText(example.label)).toBeInTheDocument();
    }

    // Drag-and-drop affordance is present alongside the file input.
    expect(screen.getByLabelText('Import a Wolf capture pack (.wolfpack.json)')).toBeInTheDocument();
    expect(screen.getByText(/drag and drop a \.wolfpack\.json file here/i)).toBeInTheDocument();
  });

  it('installs an example pack and refreshes the pack list', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    const refreshPacks = vi.fn();
    render(<PacksScreen {...baseState({ db, packs: [], refreshPacks })} />);

    const installButtons = screen.getAllByRole('button', { name: 'Install example' });
    expect(installButtons.length).toBeGreaterThan(0);

    await user.click(installButtons[0]!);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Last imported:');
    expect(refreshPacks).toHaveBeenCalled();
  });
});
