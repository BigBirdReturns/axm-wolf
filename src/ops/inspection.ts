import { WolfOpsError } from './errors.js';
import type {
  AssetPassport,
  AssetValue,
  CaptureRequest,
  InspectionPlan,
  InspectionRequirement,
  InspectionTemplate,
} from './types.js';

const SUBJECT_EXECUTORS = new Set(['subject', 'staff']);

function assertUnitInterval(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new WolfOpsError(`${field} must be between 0 and 1`);
  }
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new WolfOpsError(`${field} must be a non-negative finite number`);
  }
}

function hasValue(value: AssetValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function readField(asset: AssetPassport, field: string): AssetValue | undefined {
  switch (field) {
    case 'make':
      return asset.make;
    case 'model':
      return asset.model;
    case 'serialNumber':
      return asset.serialNumber;
    case 'location':
      return asset.location;
    default:
      return asset.attributes[field];
  }
}

export function scoreCaptureRequirement(requirement: InspectionRequirement): number {
  assertUnitInterval(requirement.expectedUncertaintyReduction, 'expectedUncertaintyReduction');
  assertUnitInterval(requirement.decisionConsequence, 'decisionConsequence');
  assertUnitInterval(requirement.safetyRisk, 'safetyRisk');
  assertNonNegative(requirement.effort, 'effort');

  const blockingMultiplier = requirement.blocking ? 1.25 : 1;
  const numerator =
    requirement.expectedUncertaintyReduction * requirement.decisionConsequence * blockingMultiplier;
  const denominator = 1 + requirement.effort + requirement.safetyRisk * 4;
  return numerator / denominator;
}

function toCaptureRequest(requirement: InspectionRequirement, asset: AssetPassport): CaptureRequest | null {
  if (requirement.targetFields.length === 0) {
    throw new WolfOpsError(`inspection requirement ${requirement.requirementId} has no target fields`);
  }

  const missingFields = requirement.targetFields.filter((field) => !hasValue(readField(asset, field)));
  if (missingFields.length === 0) return null;

  return {
    ...requirement,
    missingFields,
    informationValue: scoreCaptureRequirement(requirement),
    safeForSubject: SUBJECT_EXECUTORS.has(requirement.executor) && requirement.safetyRisk <= 0.25,
  };
}

export function buildInspectionPlan(template: InspectionTemplate, asset: AssetPassport): InspectionPlan {
  if (template.assetCategory !== asset.category) {
    throw new WolfOpsError(
      `inspection template ${template.templateId} expects ${template.assetCategory}, received ${asset.category}`,
    );
  }

  const requests = template.requirements
    .map((requirement) => toCaptureRequest(requirement, asset))
    .filter((request): request is CaptureRequest => request !== null)
    .sort((left, right) => {
      if (left.safeForSubject !== right.safeForSubject) return left.safeForSubject ? -1 : 1;
      if (right.informationValue !== left.informationValue) {
        return right.informationValue - left.informationValue;
      }
      return left.requirementId.localeCompare(right.requirementId);
    });

  const safeRequests = requests.filter((request) => request.safeForSubject);
  const nextRequest = safeRequests[0] ?? requests[0] ?? null;

  return {
    templateId: template.templateId,
    assetId: asset.assetId,
    complete: requests.length === 0,
    nextRequest,
    requests,
    blockedByProfessional: requests.length > 0 && safeRequests.length === 0,
  };
}
