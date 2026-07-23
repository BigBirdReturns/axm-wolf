import { describe, expect, it } from 'vitest';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { commitResponse, createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import { buildSurveyAnalysisHandoff, validateSurveyAnalysisReturn } from '../../src/app/lib/surveyAnalysis.js';

describe('survey analysis custody', () => {
  it('builds a frozen cited handoff and accepts only returns grounded in it', async () => {
    const pack = validatePack(genericPackJson);
    let record = createRecord({ recordId: 'SUR07', pack, packDigest: await digestPack(pack), appVersion: '0.4.0' });
    record = commitResponse(record, 'operations.normal-day', 'I check the overnight notes first.', 'typed', '2026-07-13T16:00:00.000Z');
    const handoff = await buildSurveyAnalysisHandoff(record, 'Helen', '2026-07-13T16:05:00.000Z');
    const source = handoff.sourceSnapshot[0]!;

    expect(handoff.kind).toBe('wolf-survey-analysis-handoff');
    expect(handoff.runMode).toBe('manual-subscription');
    expect(handoff.sourceSnapshot).toHaveLength(1);

    const returned = validateSurveyAnalysisReturn({
      schemaVersion: 1,
      kind: 'wolf-survey-analysis-return',
      responseId: 'return-1',
      handoffId: handoff.handoffId,
      analyst: 'Manual subscription run',
      method: 'ChatGPT subscription',
      analyzedAt: '2026-07-13T16:10:00.000Z',
      claims: [{
        claimId: 'claim-1',
        kind: 'summary',
        text: 'The morning check begins with overnight notes.',
        confidence: 'confirmed',
        sourceReferences: [{ ...source, quote: 'overnight notes' }],
      }],
    }, handoff);
    expect(returned.claims[0]?.sourceReferences[0]?.quote).toBe('overnight notes');

    expect(() => validateSurveyAnalysisReturn({ ...returned, claims: [{ ...returned.claims[0], sourceReferences: [{ ...source, quote: 'invented words' }] }] }, handoff)).toThrow(/outside the frozen handoff/i);
  });
});
