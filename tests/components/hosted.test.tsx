import { afterEach, describe, expect, it, vi } from 'vitest';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import {
  hostedSurveyCode,
  rememberHostedSession,
  syncHostedRecord,
} from '../../src/app/lib/hosted.js';

describe('hosted survey client', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('recognizes friendly survey paths', () => {
    expect(hostedSurveyCode('/wolf/SUR01')).toBe('SUR01');
    expect(hostedSurveyCode('/wolf/sur42/')).toBe('SUR42');
    expect(hostedSurveyCode('/wolf/dashboard')).toBeNull();
  });

  it('synchronizes and submits with a capability token and advancing revision', async () => {
    const pack = validatePack(genericPackJson);
    const record = createRecord({ recordId: 'SUR01', pack, packDigest: await digestPack(pack), appVersion: '0.2.0' });
    rememberHostedSession({ code: 'SUR01', token: 'private-token', revision: 0 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1, status: 'started' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2, status: 'submitted' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await syncHostedRecord(record);
    await syncHostedRecord(record, true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/wolf/api/surveys/SUR01/sync');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/wolf/api/surveys/SUR01/submit');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer private-token' });
    expect(JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string).baseRevision).toBe(1);
  });
});
