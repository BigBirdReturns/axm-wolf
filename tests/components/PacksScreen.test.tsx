import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PacksScreen } from '../../src/app/screens/PacksScreen.js';
import { openWolfDb } from '../../src/storage/index.js';
import type { WolfAppState } from '../../src/app/hooks/useWolfApp.js';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import type { CapturePack } from '../../src/engine/index.js';

const genericPack = genericPackJson as unknown as CapturePack;

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

function makeFile(name: string, contents: string): File {
  return new File([contents], name, { type: 'application/json' });
}

/**
 * DESIGN.md 4.1, 4.8, 12.3: invalid pack imports surface an error and
 * install nothing -- `refreshPacks` (the signal that a pack was persisted)
 * is never called.
 */
describe('PacksScreen', () => {
  it('shows a validation error and installs nothing for malformed JSON', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    const refreshPacks = vi.fn();
    render(<PacksScreen {...baseState({ db, packs: [], refreshPacks })} />);

    // Source: PacksScreen.tsx -- `<label htmlFor="import-pack-file">Import a Wolf capture pack (.wolfpack.json)</label>`.
    const input = screen.getByLabelText('Import a Wolf capture pack (.wolfpack.json)');
    await user.upload(input, makeFile('bad.wolfpack.json', '{ not json'));

    // Source: PacksScreen.tsx -- `{importError ? (<p role="alert" ...>{importError}</p>) : null}`,
    // and parsePackFromText throws WolfValidationError('That file is not valid JSON.').
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That file is not valid JSON.');
    expect(refreshPacks).not.toHaveBeenCalled();

    // No pack list should have been rendered (still "No packs installed.").
    expect(screen.getByText('No packs installed.')).toBeInTheDocument();
  });

  it('shows a validation error and installs nothing for a structurally-invalid pack', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    const refreshPacks = vi.fn();
    render(<PacksScreen {...baseState({ db, packs: [], refreshPacks })} />);

    // Mutate a valid pack to break it: duplicate a prompt id.
    const broken = structuredClone(genericPack) as CapturePack & { prompts: Array<{ id: string }> };
    broken.prompts[1].id = broken.prompts[0].id;

    const input = screen.getByLabelText('Import a Wolf capture pack (.wolfpack.json)');
    await user.upload(input, makeFile('broken.wolfpack.json', JSON.stringify(broken)));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(refreshPacks).not.toHaveBeenCalled();
    expect(screen.getByText('No packs installed.')).toBeInTheDocument();
  });
});
