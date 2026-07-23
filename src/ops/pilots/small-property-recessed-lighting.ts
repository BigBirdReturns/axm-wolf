import type {
  DecisionCase,
  DecisionOption,
  InspectionTemplate,
  MoneyRange,
} from '../types.js';

export const recessedLightingInspectionTemplate: InspectionTemplate = {
  templateId: 'small-property.recessed-lighting.v1',
  label: 'Recessed lighting guided inspection',
  assetCategory: 'recessed-lighting-system',
  requirements: [
    {
      requirementId: 'symptom-video',
      prompt:
        'Record one uninterrupted video showing the wall control, the full ceiling, and which fixtures wink, flicker, or remain dark while the control moves through its normal range.',
      rationale:
        'The timing pattern distinguishes independent fixture failures from a shared control, circuit, or compatibility problem.',
      captureMode: 'video',
      executor: 'subject',
      targetFields: ['failurePatternDocumented'],
      expectedUncertaintyReduction: 0.95,
      decisionConsequence: 1,
      effort: 0.2,
      safetyRisk: 0.05,
      blocking: true,
    },
    {
      requirementId: 'ceiling-layout',
      prompt:
        'Take one wide photograph that shows the complete ceiling, every recessed fixture, and enough of the room to identify each fixture position later.',
      rationale:
        'A stable spatial map lets service history and failures attach to the correct fixture rather than to a vague room-level complaint.',
      captureMode: 'photo',
      executor: 'subject',
      targetFields: ['fixtureLayoutDocumented'],
      expectedUncertaintyReduction: 0.7,
      decisionConsequence: 0.8,
      effort: 0.1,
      safetyRisk: 0.02,
    },
    {
      requirementId: 'control-photo',
      prompt:
        'Photograph the switch or dimmer face and any visible manufacturer or model markings without removing the wall plate.',
      rationale:
        'Different LED modules can exhibit the same symptom when the shared dimmer is incompatible or failing.',
      captureMode: 'photo',
      executor: 'subject',
      targetFields: ['controlModelDocumented'],
      expectedUncertaintyReduction: 0.78,
      decisionConsequence: 0.95,
      effort: 0.1,
      safetyRisk: 0.03,
      blocking: true,
    },
    {
      requirementId: 'working-failing-pair',
      prompt:
        'Take matching close photographs of one working fixture and one failing fixture from floor level, including the trim edge and apparent diameter.',
      rationale:
        'The pair reveals mixed trim families, visible heat damage, and likely size differences without disturbing the installation.',
      captureMode: 'photo',
      executor: 'subject',
      targetFields: ['workingFailingPairDocumented'],
      expectedUncertaintyReduction: 0.58,
      decisionConsequence: 0.7,
      effort: 0.12,
      safetyRisk: 0.03,
    },
    {
      requirementId: 'fixture-label-and-connector',
      prompt:
        'After the circuit is isolated and absence of voltage is confirmed, photograph the fixture label, connector, mounting arrangement, and any separate driver. This capture is for a qualified contractor or electrician.',
      rationale:
        'A documented model and connector are required before claiming that a current replacement is electrically and mechanically compatible.',
      captureMode: 'photo',
      executor: 'licensed_professional',
      targetFields: ['fixtureFamiliesDocumented', 'connectorDocumented', 'mountingDocumented'],
      expectedUncertaintyReduction: 0.98,
      decisionConsequence: 1,
      effort: 0.45,
      safetyRisk: 0.95,
      blocking: true,
    },
    {
      requirementId: 'cutout-and-housing',
      prompt:
        'With the circuit isolated, measure the ceiling cutout and document whether the fixture uses a recessed can, retrofit trim, canless wafer, or another housing arrangement.',
      rationale:
        'Standardization and replacement options depend on physical fit as well as electrical compatibility.',
      captureMode: 'measurement',
      executor: 'licensed_professional',
      targetFields: ['cutoutMeasured', 'housingTypeDocumented'],
      expectedUncertaintyReduction: 0.82,
      decisionConsequence: 0.9,
      effort: 0.5,
      safetyRisk: 0.85,
    },
    {
      requirementId: 'shared-cause-test',
      prompt:
        'Test the dimmer, supply, neutral, and affected circuit under load using appropriate instruments and record the result. This work is for a qualified electrician.',
      rationale:
        'Two discontinued fixture brands with similar symptoms may still share one upstream cause. Testing prevents unnecessary replacement.',
      captureMode: 'measurement',
      executor: 'licensed_professional',
      targetFields: ['sharedCauseTested'],
      expectedUncertaintyReduction: 0.92,
      decisionConsequence: 1,
      effort: 0.75,
      safetyRisk: 1,
      blocking: true,
    },
  ],
};

export type RecessedLightingDecisionInput = {
  caseId: string;
  assetId: string;
  currency?: string;
  brandsDiscontinued: boolean;
  failuresMoveTogether: boolean | null;
  dimmerCorrelation: boolean | null;
  compatibleReplacementVerified: boolean;
  sharedCauseRuledOut: boolean;
  failuresLastSixMonths: number;
  failedFixtureCount: number;
  remainingFixtureCount: number;
  contractorVisitCost: number;
  replacementModuleCost: number;
  roomStandardizationCost: MoneyRange;
  stagedPropertyStandardizationCost: MoneyRange;
  evidenceIds?: string[];
};

function money(currency: string, low: number, high: number): MoneyRange {
  return { currency, low: Math.max(0, low), high: Math.max(low, high) };
}

function spotReplacementOption(input: RecessedLightingDecisionInput, currency: string): DecisionOption {
  const material = input.failedFixtureCount * input.replacementModuleCost;
  const initial = input.contractorVisitCost + material;
  const recurrenceMultiplier = input.brandsDiscontinued ? 2.2 : 1.4;
  const expectedReturnVisits = Math.min(input.remainingFixtureCount, input.failuresLastSixMonths * recurrenceMultiplier);
  const fiveYearHigh = initial + expectedReturnVisits * (input.contractorVisitCost + input.replacementModuleCost);

  return {
    optionId: 'spot-replace-failed-modules',
    title: 'Replace only the failed modules',
    description:
      'Restore the current failures while preserving the remainder of the installed lighting system.',
    availability: input.compatibleReplacementVerified ? 'live' : 'conditional',
    condition: input.compatibleReplacementVerified
      ? null
      : 'A current replacement must be documented as mechanically and electrically compatible.',
    assumptions: [
      'Failures are independent after upstream causes are evaluated.',
      'A compatible current product can be sourced with acceptable light output and dimming behavior.',
    ],
    advantages: ['Lowest immediate capital requirement.', 'Smallest immediate installation footprint.'],
    tradeoffs: [
      'Mixed appearance may remain.',
      'Discontinued components increase procurement and repeat-visit risk.',
      'Each later failure can recreate the same diagnostic and scheduling cost.',
    ],
    requiredEvidenceIds: input.evidenceIds ?? [],
    requiresProfessional: true,
    metrics: {
      initialCost: money(currency, initial * 0.9, initial * 1.25),
      fiveYearCost: money(currency, initial, fiveYearHigh),
      ownerAttentionHours: 1.5 + expectedReturnVisits * 0.75,
      recurrenceRisk: input.brandsDiscontinued ? 0.78 : 0.55,
      disruption: 0.2,
      complianceRisk: input.sharedCauseRuledOut ? 0.15 : 0.45,
      reversibility: 0.9,
      evidenceConfidence: input.compatibleReplacementVerified && input.sharedCauseRuledOut ? 0.82 : 0.45,
    },
  };
}

export function buildRecessedLightingDecisionCase(
  input: RecessedLightingDecisionInput,
): DecisionCase {
  const currency = input.currency ?? 'USD';
  const sharedSymptom = input.failuresMoveTogether === true || input.dimmerCorrelation === true;
  const spareCount = Math.min(2, Math.max(1, input.remainingFixtureCount));
  const spot = spotReplacementOption(input, currency);

  const options: DecisionOption[] = [
    {
      optionId: 'diagnose-shared-control-or-circuit',
      title: 'Diagnose the shared control or circuit first',
      description:
        'Test the dimmer, supply, neutral, and circuit behavior before purchasing replacement fixtures.',
      availability: input.sharedCauseRuledOut ? 'blocked' : sharedSymptom ? 'live' : 'conditional',
      condition: input.sharedCauseRuledOut
        ? 'Blocked because a documented professional test has already ruled out the shared path.'
        : sharedSymptom
          ? null
          : 'Becomes the first branch if fixtures fail together, correlate with dimmer position, or show another common pattern.',
      assumptions: ['A licensed professional performs energized diagnostics.', 'The symptom can be reproduced or measured.'],
      advantages: [
        'Can prevent unnecessary fixture purchases.',
        'Addresses one cause that could affect multiple brands and fixtures.',
      ],
      tradeoffs: [
        'Adds a diagnostic visit before restoration when the cause proves local to the fixture.',
        'May require a return visit after parts are selected.',
      ],
      requiredEvidenceIds: input.evidenceIds ?? [],
      requiresProfessional: true,
      metrics: {
        initialCost: money(currency, input.contractorVisitCost, input.contractorVisitCost * 1.5),
        fiveYearCost: money(currency, input.contractorVisitCost, input.contractorVisitCost * 2.25),
        ownerAttentionHours: 1,
        recurrenceRisk: 0.2,
        disruption: 0.18,
        complianceRisk: 0.08,
        reversibility: 1,
        evidenceConfidence: sharedSymptom ? 0.9 : 0.7,
      },
    },
    spot,
    {
      optionId: 'replace-and-hold-verified-spares',
      title: 'Replace failures and hold verified spares',
      description:
        'Use a documented compatible module now and retain a small local stock for the remaining installed base.',
      availability: input.compatibleReplacementVerified ? 'live' : 'conditional',
      condition: input.compatibleReplacementVerified
        ? null
        : 'Requires a documented compatible product before buying inventory.',
      assumptions: [
        'The remaining installed fixtures have enough useful life to justify maintaining the mixed system.',
        'Stored spares remain appropriate for the documented connector, housing, and control.',
      ],
      advantages: [
        'Reduces procurement delay on the next failure.',
        'Preserves current appearance with limited immediate disruption.',
      ],
      tradeoffs: [
        'Ties cash to inventory.',
        'Does not remove the underlying mixed and discontinued installed base.',
      ],
      requiredEvidenceIds: input.evidenceIds ?? [],
      requiresProfessional: true,
      metrics: {
        initialCost: money(
          currency,
          spot.metrics.initialCost.low + spareCount * input.replacementModuleCost,
          spot.metrics.initialCost.high + spareCount * input.replacementModuleCost * 1.2,
        ),
        fiveYearCost: money(
          currency,
          spot.metrics.initialCost.high + spareCount * input.replacementModuleCost,
          spot.metrics.fiveYearCost.high * 0.72 + spareCount * input.replacementModuleCost,
        ),
        ownerAttentionHours: Math.max(1.5, spot.metrics.ownerAttentionHours * 0.65),
        recurrenceRisk: 0.5,
        disruption: 0.22,
        complianceRisk: input.sharedCauseRuledOut ? 0.12 : 0.4,
        reversibility: 0.82,
        evidenceConfidence: input.compatibleReplacementVerified ? 0.8 : 0.4,
      },
    },
    {
      optionId: 'standardize-room-or-circuit',
      title: 'Standardize the affected room or circuit',
      description:
        'Replace the mixed or discontinued fixtures in one coherent area with one documented current system.',
      availability: 'live',
      condition: null,
      assumptions: [
        'The selected current system fits or the scope includes documented cutout and control changes.',
        'Light output, color temperature, dimming, and location ratings are specified before purchase.',
      ],
      advantages: [
        'Creates one known standard and a simpler future parts path.',
        'Reduces visual mismatch and repeated diagnosis in the affected area.',
      ],
      tradeoffs: [
        'Higher immediate cost.',
        'Replaces some functioning equipment before individual end of life.',
      ],
      requiredEvidenceIds: input.evidenceIds ?? [],
      requiresProfessional: true,
      metrics: {
        initialCost: input.roomStandardizationCost,
        fiveYearCost: money(
          currency,
          input.roomStandardizationCost.low,
          input.roomStandardizationCost.high * 1.2,
        ),
        ownerAttentionHours: 1.75,
        recurrenceRisk: 0.15,
        disruption: 0.5,
        complianceRisk: 0.08,
        reversibility: 0.35,
        evidenceConfidence: 0.82,
      },
    },
    {
      optionId: 'stage-property-standardization',
      title: 'Stage property-wide standardization',
      description:
        'Adopt one approved fixture family and replace rooms or circuits as failures, vacancies, or planned work create economical access.',
      availability:
        input.failuresLastSixMonths >= 3 || input.brandsDiscontinued ? 'live' : 'conditional',
      condition:
        input.failuresLastSixMonths >= 3 || input.brandsDiscontinued
          ? null
          : 'Becomes preferable when recurrence, contractor mobilization, or parts scarcity crosses the recorded threshold.',
      assumptions: [
        'The property adopts a documented approved standard and keeps installation receipts.',
        'The work is staged to avoid unnecessary tenant disruption and premature replacement.',
      ],
      advantages: [
        'Lowest long-run administrative and compatibility burden.',
        'Creates predictable spares, controls, procedures, and closure tests.',
      ],
      tradeoffs: [
        'Highest capital exposure.',
        'Requires sequencing across occupied areas and may take several cycles to complete.',
      ],
      requiredEvidenceIds: input.evidenceIds ?? [],
      requiresProfessional: true,
      metrics: {
        initialCost: input.stagedPropertyStandardizationCost,
        fiveYearCost: money(
          currency,
          input.stagedPropertyStandardizationCost.low,
          input.stagedPropertyStandardizationCost.high * 1.12,
        ),
        ownerAttentionHours: 3,
        recurrenceRisk: 0.08,
        disruption: 0.72,
        complianceRisk: 0.05,
        reversibility: 0.2,
        evidenceConfidence: 0.75,
      },
    },
  ];

  return {
    caseId: input.caseId,
    title: 'Mixed discontinued recessed lighting',
    assetIds: [input.assetId],
    hypotheses: [
      {
        hypothesisId: 'shared-upstream-cause',
        statement:
          'A shared dimmer, circuit, supply, neutral, or compatibility condition contributes to failures across fixture brands.',
        status: input.sharedCauseRuledOut ? 'ruled_out' : sharedSymptom ? 'supported' : 'open',
        evidenceFor: sharedSymptom ? ['Fixtures share a timing or dimmer-correlated symptom.'] : [],
        evidenceAgainst: input.sharedCauseRuledOut ? ['A documented professional test ruled out the shared path.'] : [],
      },
      {
        hypothesisId: 'independent-end-of-life',
        statement: 'Individual drivers or modules are reaching end of life independently.',
        status: input.sharedCauseRuledOut ? 'supported' : 'open',
        evidenceFor: input.sharedCauseRuledOut ? ['Shared path was ruled out.'] : [],
        evidenceAgainst: sharedSymptom ? ['Synchronized behavior weakens a purely independent-failure explanation.'] : [],
      },
    ],
    options,
    evidenceIds: input.evidenceIds ?? [],
    reopeningTriggers: [
      'Another fixture fails or begins flickering.',
      'Failures occur together or change with dimmer position.',
      'A proposed compatible replacement cannot be documented.',
      'A contractor visit costs more than the recorded repair threshold.',
      'Heat, odor, buzzing, discoloration, sparking, or other safety symptoms appear.',
    ],
  };
}
