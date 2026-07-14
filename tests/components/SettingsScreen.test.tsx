import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SettingsScreen } from '../../src/app/screens/SettingsScreen.js';

/**
 * DESIGN.md 12.4: the wipe-all action stays disabled until the subject both
 * checks the acknowledgement box AND types the exact confirmation phrase
 * ('delete everything', case-insensitive). SettingsScreen opens its own
 * `WolfDb` handle via `openWolfDb()` in an effect (fake-indexeddb/auto from
 * setup.ts makes this resolve in jsdom), so the button also depends on that
 * db handle becoming available.
 *
 * This test only exercises the disabled/enabled gating -- it never clicks
 * the enabled button, since `handleWipeAll` calls
 * `window.location.assign('#/')` and `window.location.reload()`, which are
 * not implemented in jsdom and would throw.
 */
describe('SettingsScreen', () => {
  it('exposes a separate knowledge custody backup with restore-order and encryption warnings', async () => {
    render(<SettingsScreen />);
    const exportButton = await screen.findByRole('button', { name: 'Export knowledge backup' });
    await waitFor(() => expect(exportButton).toBeEnabled());
    expect(screen.getByLabelText('Restore knowledge backup')).toHaveAttribute('accept', expect.stringContaining('.wolfkb.json'));
    expect(screen.getByRole('heading', { name: 'Knowledge backup' }).parentElement).toHaveTextContent(/import the source.*records first/i);
    expect(screen.getByText(/Knowledge backups are not encrypted/i)).toBeInTheDocument();
  });

  it('disables "Delete all local data" until both the checkbox and phrase are provided', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    // Wait for the openWolfDb() effect to resolve (fake-indexeddb) -- the
    // button text is stable across that transition, so findByRole waits for
    // the db handle without us needing to assert on it directly.
    const button = await screen.findByRole('button', { name: 'Delete all local data' });
    expect(button).toBeDisabled();

    // Source: SettingsScreen.tsx -- the acknowledgement checkbox label.
    const checkbox = screen.getByLabelText(
      'I have exported anything I want to keep, and understand this cannot be undone',
    );
    await user.click(checkbox);
    expect(button).toBeDisabled();
    await user.click(checkbox);

    // Source: SettingsScreen.tsx -- `Type "{CONFIRM_PHRASE}" to confirm`.
    const confirmInput = screen.getByLabelText('Type “delete everything” to confirm');
    await user.type(confirmInput, 'delete everything');
    expect(button).toBeDisabled();

    await user.click(checkbox);
    expect(button).toBeEnabled();

    // Unchecking re-disables even with the phrase still present.
    await user.click(checkbox);
    expect(button).toBeDisabled();

    // Case-insensitive match re-enables.
    await user.click(checkbox);
    await user.clear(confirmInput);
    await user.type(confirmInput, 'DELETE EVERYTHING');
    expect(button).toBeEnabled();
  });
});
