import { WolfOpsError } from './errors.js';
import type {
  ResolutionKind,
  WorkOrder,
  WorkOrderStatus,
  WorkOrderTransition,
} from './types.js';

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  observed: ['classified'],
  classified: ['triaged'],
  triaged: ['assigned'],
  assigned: ['temporarily_stabilized', 'verified'],
  temporarily_stabilized: ['assigned', 'verified'],
  verified: ['closed'],
  closed: [],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function createWorkOrder(input: {
  workOrderId: string;
  assetId?: string | null;
  summary: string;
  at: string;
  actor: string;
  evidenceIds?: string[];
}): WorkOrder {
  if (input.summary.trim().length === 0) throw new WolfOpsError('work order summary must not be empty');
  const evidenceIds = unique(input.evidenceIds ?? []);
  return {
    workOrderId: input.workOrderId,
    assetId: input.assetId ?? null,
    summary: input.summary,
    status: 'observed',
    resolutionKind: 'none',
    owner: null,
    dueAt: null,
    evidenceIds,
    verificationEvidenceIds: [],
    updatedAt: input.at,
    history: [
      {
        from: null,
        to: 'observed',
        at: input.at,
        actor: input.actor,
        note: input.summary,
        evidenceIds,
      },
    ],
  };
}

function validateTransition(order: WorkOrder, nextStatus: WorkOrderStatus, transition: WorkOrderTransition): void {
  if (!ALLOWED_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new WolfOpsError(`cannot move work order from ${order.status} to ${nextStatus}`);
  }

  const requestedResolution = transition.resolutionKind ?? order.resolutionKind;
  const evidenceIds = transition.evidenceIds ?? [];

  if (nextStatus === 'assigned' && (transition.owner ?? order.owner) === null) {
    throw new WolfOpsError('assigned work orders require an owner');
  }

  if (nextStatus === 'temporarily_stabilized') {
    if (requestedResolution !== 'temporary') {
      throw new WolfOpsError('temporary stabilization must be labeled temporary');
    }
    if ((transition.dueAt ?? order.dueAt) === null) {
      throw new WolfOpsError('temporary stabilization requires a durable follow-up date');
    }
  }

  if (nextStatus === 'verified') {
    if (requestedResolution !== 'durable') {
      throw new WolfOpsError('verification requires a durable resolution; a patch cannot be verified closed');
    }
    if (evidenceIds.length === 0) {
      throw new WolfOpsError('verification requires closure evidence');
    }
  }

  if (nextStatus === 'closed') {
    if (order.resolutionKind !== 'durable') {
      throw new WolfOpsError('only a durable resolution can be closed');
    }
    if (order.verificationEvidenceIds.length === 0) {
      throw new WolfOpsError('closed work orders require prior verification evidence');
    }
  }
}

export function transitionWorkOrder(
  order: WorkOrder,
  nextStatus: WorkOrderStatus,
  transition: WorkOrderTransition,
): WorkOrder {
  validateTransition(order, nextStatus, transition);

  const evidenceIds = unique(transition.evidenceIds ?? []);
  const resolutionKind: ResolutionKind = transition.resolutionKind ?? order.resolutionKind;
  const verificationEvidenceIds =
    nextStatus === 'verified'
      ? unique([...order.verificationEvidenceIds, ...evidenceIds])
      : [...order.verificationEvidenceIds];

  return {
    ...order,
    status: nextStatus,
    resolutionKind,
    owner: transition.owner === undefined ? order.owner : transition.owner,
    dueAt: transition.dueAt === undefined ? order.dueAt : transition.dueAt,
    evidenceIds: unique([...order.evidenceIds, ...evidenceIds]),
    verificationEvidenceIds,
    updatedAt: transition.at,
    history: [
      ...order.history,
      {
        from: order.status,
        to: nextStatus,
        at: transition.at,
        actor: transition.actor,
        note: transition.note,
        evidenceIds,
      },
    ],
  };
}
