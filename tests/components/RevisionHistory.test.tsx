import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RevisionHistory } from '../../src/app/components/RevisionHistory.js';
import type { ResponseRevision } from '../../src/engine/index.js';

function makeRevision(overrides: Partial<ResponseRevision>): ResponseRevision {
  return {
    revisionId: 'rev-1',
    text: 'First answer',
    capturedAt: '2024-01-01T00:00:00.000Z',
    source: 'typed',
    locale: 'en-US',
    supersedesRevisionId: null,
    ...overrides,
  };
}

describe('RevisionHistory', () => {
  it('renders nothing for zero revisions', () => {
    const { container } = render(<RevisionHistory revisions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the revision count and reveals newest-first revisions with timestamp/source on expand', async () => {
    const revisions: ResponseRevision[] = [
      makeRevision({
        revisionId: 'rev-1',
        text: 'First answer',
        capturedAt: '2024-01-01T00:00:00.000Z',
        source: 'typed',
      }),
      makeRevision({
        revisionId: 'rev-2',
        text: 'Second answer, refined',
        capturedAt: '2024-02-01T00:00:00.000Z',
        source: 'speech_transcript',
        supersedesRevisionId: 'rev-1',
      }),
    ];

    render(<RevisionHistory revisions={revisions} />);

    const toggle = screen.getByRole('button', { name: 'Revision history (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Collapsed by default: revision text is not yet in the document.
    expect(screen.queryByText('First answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Second answer, refined')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    // Newest-first: the second revision (speech transcript) appears before
    // the first (typed).
    expect(items[0]).toHaveTextContent('Second answer, refined');
    expect(items[0]).toHaveTextContent('Speech transcript');
    expect(items[1]).toHaveTextContent('First answer');
    expect(items[1]).toHaveTextContent('Typed');

    // Timestamps are rendered via toLocaleString() -- assert the formatted
    // date portion is present rather than the raw ISO string.
    const expectedFirst = new Date('2024-01-01T00:00:00.000Z').toLocaleString();
    const expectedSecond = new Date('2024-02-01T00:00:00.000Z').toLocaleString();
    expect(items[1]).toHaveTextContent(expectedFirst);
    expect(items[0]).toHaveTextContent(expectedSecond);
  });
});
