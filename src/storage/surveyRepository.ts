import type { WolfDb } from './db.js';

export type SurveyWorkflowStatus = 'invited' | 'started' | 'received' | 'submitted' | 'analyzing' | 'completed';

export type SurveyAssignment = {
  assignmentId: string;
  packId: string;
  recipientLabel: string;
  surveyLabel: string;
  status: SurveyWorkflowStatus;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  hosted?: boolean;
  invitationToken?: string;
};

export async function saveSurveyAssignment(db: WolfDb, assignment: SurveyAssignment): Promise<void> {
  await db.put('surveyAssignments', assignment);
}

export async function loadSurveyAssignment(db: WolfDb, assignmentId: string): Promise<SurveyAssignment | null> {
  return (await db.get<SurveyAssignment>('surveyAssignments', assignmentId)) ?? null;
}

export async function listSurveyAssignments(db: WolfDb): Promise<SurveyAssignment[]> {
  const assignments = await db.getAll<SurveyAssignment>('surveyAssignments');
  return assignments.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateSurveyAssignmentStatus(
  db: WolfDb,
  assignmentId: string,
  status: SurveyWorkflowStatus,
  now = new Date().toISOString(),
): Promise<SurveyAssignment> {
  const assignment = await loadSurveyAssignment(db, assignmentId);
  if (!assignment) throw new Error(`Survey assignment "${assignmentId}" was not found.`);
  const updated: SurveyAssignment = {
    ...assignment,
    status,
    updatedAt: now,
    receivedAt: status === 'received' && assignment.receivedAt === null ? now : assignment.receivedAt,
  };
  await saveSurveyAssignment(db, updated);
  return updated;
}

export async function markSurveyReceived(
  db: WolfDb,
  input: {
    assignmentId: string;
    packId: string;
    recipientLabel: string;
    surveyLabel: string;
  },
  now = new Date().toISOString(),
): Promise<SurveyAssignment> {
  const existing = await loadSurveyAssignment(db, input.assignmentId);
  const updated: SurveyAssignment = existing
    ? {
        ...existing,
        status: existing.status === 'completed' ? 'completed' : 'received',
        updatedAt: now,
        receivedAt: existing.receivedAt ?? now,
      }
    : {
        ...input,
        status: 'received',
        createdAt: now,
        updatedAt: now,
        receivedAt: now,
      };
  await saveSurveyAssignment(db, updated);
  return updated;
}
