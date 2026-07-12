import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OpsScreen } from '../../src/app/screens/OpsScreen.js';
import { clearAllData } from '../../src/storage/maintenance.js';
import { openWolfDb } from '../../src/storage/index.js';

describe('OpsScreen', () => {
  it('requires branch-changing facts before directing the first camera view', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    await screen.findByRole('heading', { name: 'See the system before choosing the fix' });
    expect(screen.getByText('Answer the required branch-changing facts to generate the next evidence request.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/smoke, sparking/), 'false');
    await user.selectOptions(screen.getByLabelText(/multiple fixtures wink out/), 'unknown');
    await user.selectOptions(screen.getByLabelText(/controlled by a dimmer/), 'unknown');
    await user.selectOptions(screen.getByLabelText(/symptom change at a different dimmer position/), 'unknown');
    await user.selectOptions(screen.getByLabelText(/manufacturer and model documented/), 'true');
    await user.selectOptions(screen.getByLabelText(/replacement or standardization path/), 'false');

    expect(await screen.findByRole('heading', { name: 'Whole-room fixture map' })).toBeInTheDocument();
    expect(screen.getByText(/Take one wide photograph showing the complete ceiling/)).toBeInTheDocument();
    expect(screen.getAllByText(/non-dominated/).length).toBeGreaterThan(1);

    view.unmount();
    db.close();
  });

  it('switches to the cafe configuration without mixing the two local cases', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    const selector = await screen.findByLabelText('Inspection configuration');
    await user.selectOptions(selector, 'cafe-display');

    expect(await screen.findByText('Customer-facing display inspection')).toBeInTheDocument();
    expect(screen.getByLabelText(/liquid intrusion/)).toBeInTheDocument();

    view.unmount();
    db.close();
  });
});
