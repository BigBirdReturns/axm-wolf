import type {
  OpsWorkOrder,
  RecurrenceMatch,
  WorkOrderStatus,
  WorkOrderTransitionInput,
} from './types.js';

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  observed: ['classified', 'cancelled'],
  classified: ['triaged', 'cancelled'],
  triaged: ['assigned', 'cancelled'],
  assigned: ['stabilized', 'verified', 'cancelled'],
  stabilized: ['assigned', 'verified', 'cancelled'],
  verified: ['assigned', 'closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

export function createWorkOrder(input: {
  workOrderId: string;
  caseId: string;
  assetId?: string | null;
  issueCode: string;
  title: string;
  openedAt?: string;
  recurrenceOfWorkOrderIds?: string[];
}): OpsWorkOrder {
  const openedAt = input.openedAt ?? new Date().toISOString();
  if (input.issueCode.trim().length === 0) throw new Error('A work order requires an issue code');
  if (input.title.trim().length === 0) throw new Error('A work order requires a title');

  return {
    workOrderId: input.workOrderId,
    caseId: input.caseId,
    assetId: input.assetId ?? null,
    issueCode: input.issueCode.trim(),
    title: input.title.trim(),
    status: 'observed',
    openedAt,
    updatedAt: openedAt,
    assignedTo: null,
    recurrenceOfWorkOrderIds: [...new Set(input.recurrenceOfWorkOrderIds ?? [])],
    stabilizationNote: null,
    verificationTest: null,
    verificationEvidenceIds: [],
    followUpCompleted: false,
    transitions: [],
  };
}

function requireNonEmpty(value: string | null | undefined, message: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) throw new Error(message);
  return normalized;
}

export function transitionWorkOrder(
  workOrder: OpsWorkOrder,
  input: WorkOrderTransitionInput,
): OpsWorkOrder {
  if (!ALLOWED_TRANSITIONS[workOrder.status].includes(input.to)) {
    throw new Error(`Work order cannot transition from ${workOrder.status} to ${input.to}`);
  }

  const note = input.note?.trim() || null;
  const evidenceIds = [...new Set(input.evidenceIds ?? [])];
  let assignedTo = input.assignedTo === undefined ? workOrder.assignedTo : input.assignedTo;
  let stabilizationNote = workOrder.stabilizationNote;
  let verificationTest = workOrder.verificationTest;
  let verificationEvidenceIds = workOrder.verificationEvidenceIds;
  let followUpCompleted = input.followUpCompleted ?? workOrder.followUpCompleted;

  if (input.to === 'assigned') {
    assignedTo = requireNonEmpty(assignedTo, 'Assignment requires an owner');
    if (workOrder.status === 'verified') {
      verificationTest = null;
      verificationEvidenceIds = [];
      followUpCompleted = false;
    }
  }

  if (input.to === 'stabilized') {
    stabilizationNote = requireNonEmpty(note, 'Temporary stabilization requires a note describing what remains open');
  }

  if (input.to === 'verified') {
    verificationTest = requireNonEmpty(
      input.verificationTest,
      'Verification requires a named closure test',
    );
    if (evidenceIds.length === 0) {
      throw new Error('Verification requires at least one evidence artifact');
    }
    verificationEvidenceIds = evidenceIds;
  }

  if (input.to === 'closed') {
    if (!followUpCompleted) {
      throw new Error('A verified work order cannot close until follow-up is complete');
    }
    if (!workOrder.verificationTest || workOrder.verificationEvidenceIds.length === 0) {
      throw new Error('A work order cannot close without prior verification evidence');
    }
  }

  if (input.to === 'cancelled') {
    requireNonEmpty(note, 'Cancellation requires a reason');
  }

  return {
    ...workOrder,
    status: input.to,
    updatedAt: input.at,
    assignedTo,
    stabilizationNote,
    verificationTest,
    verificationEvidenceIds,
    followUpCompleted,
    transitions: [
      ...workOrder.transitions,
      {
        from: workOrder.status,
        to: input.to,
        at: input.at,
        actor: input.actor,
        note,
        evidenceIds,
      },
    ],
  };
}

export function findRecurrenceMatches(
  candidate: Pick<OpsWorkOrder, 'workOrderId' | 'assetId' | 'issueCode' | 'openedAt'>,
  existing: OpsWorkOrder[],
  windowDays = 730,
): RecurrenceMatch[] {
  if (candidate.assetId === null || windowDays < 0) return [];

  const candidateTime = Date.parse(candidate.openedAt);
  if (!Number.isFinite(candidateTime)) throw new Error('Candidate work order has an invalid openedAt timestamp');
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  return existing
    .filter((workOrder) => workOrder.workOrderId !== candidate.workOrderId)
    .filter((workOrder) => workOrder.assetId === candidate.assetId)
    .filter((workOrder) => workOrder.issueCode === candidate.issueCode)
    .filter((workOrder) => workOrder.status !== 'cancelled')
    .filter((workOrder) => {
      const openedAt = Date.parse(workOrder.openedAt);
      return Number.isFinite(openedAt) && openedAt <= candidateTime && candidateTime - openedAt <= windowMs;
    })
    .sort((left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt))
    .map((workOrder) => ({
      workOrderId: workOrder.workOrderId,
      openedAt: workOrder.openedAt,
      status: workOrder.status,
    }));
}

export function linkRecurrence(
  workOrder: OpsWorkOrder,
  matches: RecurrenceMatch[],
): OpsWorkOrder {
  return {
    ...workOrder,
    recurrenceOfWorkOrderIds: [
      ...new Set([...workOrder.recurrenceOfWorkOrderIds, ...matches.map((match) => match.workOrderId)]),
    ],
  };
}
