import type {
  AssetPassport,
  InspectionTemplate,
  MaintenanceProcedure,
} from '../types.js';

export const cafeDisplayInspectionTemplate: InspectionTemplate = {
  templateId: 'small-cafe.display-screen.v1',
  label: 'Café display screen guided inspection',
  assetCategory: 'commercial-display-screen',
  requirements: [
    {
      requirementId: 'installation-context',
      prompt:
        'Take one wide photograph showing the screen, wall or mount, nearby vents, steam or heat sources, and the surrounding customer area.',
      rationale:
        'The installation context identifies blocked airflow, environmental exposure, access constraints, and customer disruption before a maintenance procedure is scheduled.',
      captureMode: 'photo',
      executor: 'staff',
      targetFields: ['installationContextDocumented'],
      expectedUncertaintyReduction: 0.62,
      decisionConsequence: 0.75,
      effort: 0.08,
      safetyRisk: 0.02,
    },
    {
      requirementId: 'rear-ventilation',
      prompt:
        'With the screen powered off and accessible without climbing or opening the housing, photograph the rear ventilation openings, dust condition, and clearance from the wall.',
      rationale:
        'External dust and inadequate clearance are preventable contributors to heat stress and shortened equipment life.',
      captureMode: 'photo',
      executor: 'staff',
      targetFields: ['ventConditionDocumented', 'rearClearanceDocumented'],
      expectedUncertaintyReduction: 0.9,
      decisionConsequence: 0.95,
      effort: 0.12,
      safetyRisk: 0.08,
      blocking: true,
    },
    {
      requirementId: 'model-label',
      prompt:
        'Photograph the manufacturer and model label. Do not remove covers. Ask a contractor to capture it if the label cannot be reached safely from the floor.',
      rationale:
        'The model is needed to confirm manufacturer cleaning guidance, operating limits, and replacement specifications.',
      captureMode: 'photo',
      executor: 'staff',
      targetFields: ['make', 'model'],
      expectedUncertaintyReduction: 0.88,
      decisionConsequence: 0.8,
      effort: 0.16,
      safetyRisk: 0.15,
      blocking: true,
    },
    {
      requirementId: 'manufacturer-guidance',
      prompt:
        'Attach or identify the manufacturer cleaning and ventilation guidance for this exact model before the procedure is treated as confirmed.',
      rationale:
        'A generic external-cleaning procedure is only provisional until the model-specific method and interval are documented.',
      captureMode: 'document',
      executor: 'staff',
      targetFields: ['manufacturerGuidanceDocumented'],
      expectedUncertaintyReduction: 0.76,
      decisionConsequence: 0.78,
      effort: 0.2,
      safetyRisk: 0,
      blocking: true,
    },
    {
      requirementId: 'operating-environment',
      prompt:
        'Record normal daily operating hours and whether the screen is exposed to direct sun, cooking heat, steam, grease, or unusually warm air.',
      rationale:
        'Operating duration and environment determine whether a generic monthly interval is sufficient or should be shortened.',
      captureMode: 'spoken_answer',
      executor: 'staff',
      targetFields: ['dailyOperatingHours', 'environmentExposureDocumented'],
      expectedUncertaintyReduction: 0.55,
      decisionConsequence: 0.65,
      effort: 0.05,
      safetyRisk: 0,
    },
  ],
};

export function buildDisplayVentilationProcedure(input: {
  asset: AssetPassport;
  assignedRole: string;
  intervalDays?: number;
  sourceEvidenceIds?: string[];
}): MaintenanceProcedure {
  const intervalDays = input.intervalDays ?? 30;
  const modelKnown = Boolean(input.asset.make?.trim() && input.asset.model?.trim());
  const guidanceKnown = input.asset.attributes.manufacturerGuidanceDocumented === true;
  const sourceEvidenceIds = input.sourceEvidenceIds ?? input.asset.evidenceIds;

  return {
    procedureId: `${input.asset.assetId}.external-ventilation-care`,
    assetCategory: input.asset.category,
    title: `Inspect and clean external ventilation for ${input.asset.label}`,
    preventedFailure:
      'Heat stress, accelerated component aging, and avoidable loss caused by obstructed external airflow.',
    steps: [
      'Perform the work outside customer service or another safe low-disruption period.',
      'Power the display off using the normal control and follow the manufacturer shutdown guidance when available.',
      'Inspect external ventilation openings and the surrounding clearance without opening the housing.',
      'Remove loose external dust using a method permitted by the confirmed manufacturer guidance; do not introduce liquid into openings.',
      'Confirm that ventilation openings remain unobstructed and that cables or wall placement do not block airflow.',
      'Record any heat discoloration, odor, unusual noise, damaged cable, or unstable mount as a separate work order rather than treating it as routine cleaning.',
    ],
    intervalDays,
    trigger: 'Repeat sooner when visible dust, higher heat exposure, or manufacturer guidance requires it.',
    assignedRole: input.assignedRole,
    safetyBoundary:
      'Do not open the housing, work from an unstable climbing position, or service energized internal components. Escalate inaccessible or abnormal conditions to a qualified contractor.',
    closureEvidence: [
      'One timestamped photograph showing clear external ventilation openings.',
      'One timestamped photograph showing the final rear or side clearance.',
      'A note recording abnormalities or stating that none were observed.',
    ],
    status: modelKnown && guidanceKnown ? 'confirmed' : 'provisional',
    sourceEvidenceIds,
  };
}
