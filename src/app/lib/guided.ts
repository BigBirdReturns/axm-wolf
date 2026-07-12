import { getCurrentResponse, type WolfRecord } from '../../engine/index.js';

const GUIDED_SESSION_KEY = 'axm-wolf-guided-pack';

export function beginGuidedSession(packId: string): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(GUIDED_SESSION_KEY, packId);
}

export function guidedPackId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(GUIDED_SESSION_KEY);
}

export function endGuidedSession(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(GUIDED_SESSION_KEY);
}

export function nextGuidedPromptId(record: WolfRecord): string | null {
  const draft = record.drafts.find((entry) => entry.text.trim().length > 0);
  if (draft) return draft.promptId;
  return record.packSnapshot.prompts.find((prompt) => !getCurrentResponse(record, prompt.id))?.id ?? null;
}

export function guidedDestination(record: WolfRecord): string {
  const promptId = nextGuidedPromptId(record);
  return promptId
    ? `#/record/${encodeURIComponent(record.recordId)}/prompt/${encodeURIComponent(promptId)}`
    : `#/record/${encodeURIComponent(record.recordId)}`;
}
