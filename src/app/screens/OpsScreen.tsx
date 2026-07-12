import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  attachEvidenceToAsset,
  buildInspectionGuidance,
  cafeDisplayDecisionCase,
  cafeDisplayPlaybook,
  completeCaptureRequest,
  createAssetPassport,
  createInspectionCase,
  createObservation,
  createWorkOrder,
  evaluateDecisionCase,
  findRecurrenceMatches,
  linkRecurrence,
  markInspectionReadyForReview,
  recessedLightingDecisionCase,
  recessedLightingPlaybook,
  setInspectionFact,
  skipCaptureRequest,
  transitionWorkOrder,
  updateAssetPassport,
  type CaptureRequest,
  type DecisionCase,
  type EvidenceArtifact,
  type EvidenceKind,
  type EvidenceSourceClass,
  type FactPrompt,
  type InspectionPlaybook,
  type ObservationKind,
  type OpsAssetPassport,
  type OpsInspectionCase,
  type OpsObservation,
  type OpsWorkOrder,
  type OpsAnalysisReceipt,
  type ScalarFact,
  type WorkOrderStatus,
  type WorkOrderTransitionInput,
} from '../../ops/index.js';
import {
  commitOpsEvidenceCapture,
  deleteOpsInspectionCase,
  exportOpsArchive,
  createOpsAnalysisSubmission,
  importOpsAnalysisReturn,
  importOpsArchive,
  listOpsAnalysisReceipts,
  listAllOpsWorkOrders,
  listOpsEvidenceArtifacts,
  listOpsInspectionCases,
  listOpsObservations,
  listOpsWorkOrders,
  loadOpsAssetPassport,
  loadOpsInspectionCase,
  saveOpsCaseAndAsset,
  saveOpsInspectionCase,
  saveOpsObservation,
  saveOpsWorkOrder,
  reviewAnalysisObservation,
  type WolfDb,
  type OpsAnalysisSubmission,
} from '../../storage/index.js';
import { downloadText } from '../lib/download.js';
import { useSpeechInput } from '../speech/useSpeechInput.js';
import '../styles/ops.css';

type OpsConfiguration = {
  playbook: InspectionPlaybook;
  decisionCase: DecisionCase;
};

type AssetDraft = Pick<
  OpsAssetPassport,
  'displayName' | 'siteLabel' | 'locationLabel' | 'manufacturer' | 'model' | 'serialNumber'
>;

const CONFIGURATIONS: OpsConfiguration[] = [
  { playbook: recessedLightingPlaybook, decisionCase: recessedLightingDecisionCase },
  { playbook: cafeDisplayPlaybook, decisionCase: cafeDisplayDecisionCase },
];

const HUMAN_SOURCE_OPTIONS: Array<{ value: EvidenceSourceClass; label: string }> = [
  { value: 'operator_observed', label: 'Directly observed' },
  { value: 'occupant_reported', label: 'Occupant or customer reported' },
  { value: 'contractor_documented', label: 'Contractor documented' },
  { value: 'manufacturer_documented', label: 'Manufacturer documented' },
  { value: 'official_source', label: 'Official source' },
];

const OBSERVATION_KIND_OPTIONS: Array<{ value: ObservationKind; label: string }> = [
  { value: 'direct_observation', label: 'Direct observation' },
  { value: 'reported_symptom', label: 'Reported symptom' },
  { value: 'documented_fact', label: 'Documented fact' },
  { value: 'measurement', label: 'Measurement' },
];

function configurationFor(playbookId: string): OpsConfiguration {
  return (
    CONFIGURATIONS.find((configuration) => configuration.playbook.playbookId === playbookId) ??
    CONFIGURATIONS[0]!
  );
}

function makeId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function createAssetAndCase(playbook: InspectionPlaybook): {
  asset: OpsAssetPassport;
  inspectionCase: OpsInspectionCase;
} {
  const now = new Date().toISOString();
  const asset = createAssetPassport({
    assetId: makeId('asset'),
    displayName: playbook.title,
    category: playbook.assetCategory,
    now,
  });
  const inspectionCase = createInspectionCase({
    caseId: makeId('case'),
    playbook,
    title: asset.displayName,
    assetId: asset.assetId,
    now,
  });
  return { asset, inspectionCase };
}

function normalizeInspectionCase(inspectionCase: OpsInspectionCase): OpsInspectionCase {
  return {
    ...inspectionCase,
    factProvenance: inspectionCase.factProvenance ?? {},
  };
}

function assetDraftFrom(asset: OpsAssetPassport): AssetDraft {
  return {
    displayName: asset.displayName,
    siteLabel: asset.siteLabel,
    locationLabel: asset.locationLabel,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
  };
}

function inferEvidenceKind(file: File): EvidenceKind {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

function acceptForRequest(request: CaptureRequest): string {
  const values = new Set<string>();
  if (request.acceptedKinds.includes('photo') || request.acceptedKinds.includes('measurement')) {
    values.add('image/*');
  }
  if (request.acceptedKinds.includes('video')) values.add('video/*');
  if (request.acceptedKinds.includes('document')) {
    values.add('application/pdf');
    values.add('text/plain');
    values.add('image/*');
  }
  return [...values].join(',');
}

function readFactControlValue(prompt: FactPrompt, raw: string): ScalarFact {
  if (raw === '') return null;
  if (prompt.kind === 'boolean') return raw === 'true';
  return raw;
}

function writeFactControlValue(prompt: FactPrompt, value: ScalarFact | undefined): string {
  if (value === undefined || value === null) return '';
  if (prompt.kind === 'boolean') return value === true ? 'true' : 'false';
  return String(value);
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

function sourceLabel(sourceClass: EvidenceSourceClass): string {
  return (
    HUMAN_SOURCE_OPTIONS.find((option) => option.value === sourceClass)?.label ??
    sourceClass.replaceAll('_', ' ')
  );
}

function WorkOrderCard({
  workOrder,
  artifacts,
  onTransition,
}: {
  workOrder: OpsWorkOrder;
  artifacts: EvidenceArtifact[];
  onTransition: (input: WorkOrderTransitionInput) => Promise<void>;
}): JSX.Element {
  const [actor, setActor] = useState('Operator');
  const [assignedTo, setAssignedTo] = useState(workOrder.assignedTo ?? '');
  const [note, setNote] = useState('');
  const [verificationTest, setVerificationTest] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [followUpCompleted, setFollowUpCompleted] = useState(false);

  const transition = (to: WorkOrderStatus, extra: Partial<WorkOrderTransitionInput> = {}) =>
    onTransition({ to, at: new Date().toISOString(), actor, note, ...extra });

  return (
    <article className="card stack">
      <div className="row ops-progress-row">
        <div>
          <p className="meta">{workOrder.issueCode}</p>
          <h3>{workOrder.title}</h3>
        </div>
        <span className="status-pill">{statusLabel(workOrder.status)}</span>
      </div>
      <p className="meta">
        {workOrder.assignedTo ? `Assigned to ${workOrder.assignedTo}` : 'Not assigned'}
        {workOrder.recurrenceOfWorkOrderIds.length > 0
          ? ` · recurrence of ${workOrder.recurrenceOfWorkOrderIds.length} prior order`
          : ''}
      </p>
      {workOrder.verificationTest ? <p>Verification test: {workOrder.verificationTest}</p> : null}
      {!['closed', 'cancelled'].includes(workOrder.status) ? (
        <div className="ops-fact-grid">
          <div className="ops-field">
            <label htmlFor={`work-actor-${workOrder.workOrderId}`}>Actor</label>
            <input id={`work-actor-${workOrder.workOrderId}`} value={actor} onChange={(event) => setActor(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor={`work-note-${workOrder.workOrderId}`}>Transition note</label>
            <input id={`work-note-${workOrder.workOrderId}`} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
      ) : null}
      {workOrder.status === 'triaged' ? (
        <div className="ops-field">
          <label htmlFor={`work-assignee-${workOrder.workOrderId}`}>Assign to</label>
          <input id={`work-assignee-${workOrder.workOrderId}`} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} />
        </div>
      ) : null}
      {workOrder.status === 'assigned' || workOrder.status === 'stabilized' ? (
        <div className="ops-fact-grid">
          <div className="ops-field">
            <label htmlFor={`work-test-${workOrder.workOrderId}`}>Named verification test</label>
            <input id={`work-test-${workOrder.workOrderId}`} value={verificationTest} onChange={(event) => setVerificationTest(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor={`work-evidence-${workOrder.workOrderId}`}>Verification evidence</label>
            <select id={`work-evidence-${workOrder.workOrderId}`} value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>
              <option value="">Choose captured evidence</option>
              {artifacts.map((artifact) => (
                <option key={artifact.artifactId} value={artifact.artifactId}>{artifact.fileName ?? artifact.requestId}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {workOrder.status === 'verified' ? (
        <label className="row">
          <input type="checkbox" checked={followUpCompleted} onChange={(event) => setFollowUpCompleted(event.target.checked)} />
          Durable follow-up is complete
        </label>
      ) : null}
      <div className="row">
        {workOrder.status === 'observed' ? <button type="button" className="btn" onClick={() => void transition('classified')}>Classify</button> : null}
        {workOrder.status === 'classified' ? <button type="button" className="btn" onClick={() => void transition('triaged')}>Triage</button> : null}
        {workOrder.status === 'triaged' ? <button type="button" className="btn" onClick={() => void transition('assigned', { assignedTo })}>Assign</button> : null}
        {workOrder.status === 'assigned' ? <button type="button" className="btn btn--secondary" onClick={() => void transition('stabilized')}>Record temporary stabilization</button> : null}
        {workOrder.status === 'stabilized' ? <button type="button" className="btn btn--secondary" onClick={() => void transition('assigned', { assignedTo: workOrder.assignedTo })}>Return to assigned</button> : null}
        {workOrder.status === 'assigned' || workOrder.status === 'stabilized' ? <button type="button" className="btn" onClick={() => void transition('verified', { verificationTest, evidenceIds: evidenceId ? [evidenceId] : [] })}>Verify</button> : null}
        {workOrder.status === 'verified' ? <><button type="button" className="btn" onClick={() => void transition('closed', { followUpCompleted })}>Close durably</button><button type="button" className="btn btn--secondary" onClick={() => void transition('assigned', { assignedTo: workOrder.assignedTo })}>Reopen</button></> : null}
        {!['closed', 'cancelled'].includes(workOrder.status) ? <button type="button" className="btn btn--secondary" onClick={() => void transition('cancelled')}>Cancel with reason</button> : null}
      </div>
      {workOrder.transitions.length > 0 ? <details><summary>{workOrder.transitions.length} state transitions</summary><ol>{workOrder.transitions.map((entry, index) => <li key={`${entry.at}-${index}`}>{entry.from} → {entry.to} · {entry.actor} · {entry.at}</li>)}</ol></details> : null}
    </article>
  );
}

export function OpsScreen({ db }: { db: WolfDb }): JSX.Element {
  const [playbookId, setPlaybookId] = useState(recessedLightingPlaybook.playbookId);
  const configuration = configurationFor(playbookId);
  const [cases, setCases] = useState<OpsInspectionCase[]>([]);
  const [inspectionCase, setInspectionCase] = useState<OpsInspectionCase | null>(null);
  const [asset, setAsset] = useState<OpsAssetPassport | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft | null>(null);
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [observations, setObservations] = useState<OpsObservation[]>([]);
  const [observationText, setObservationText] = useState('');
  const [observationKind, setObservationKind] = useState<ObservationKind>('direct_observation');
  const [observationSource, setObservationSource] =
    useState<EvidenceSourceClass>('operator_observed');
  const [observationSourceLabel, setObservationSourceLabel] = useState('');
  const [observationEvidenceId, setObservationEvidenceId] = useState('');
  const [workOrders, setWorkOrders] = useState<OpsWorkOrder[]>([]);
  const [workOrderIssueCode, setWorkOrderIssueCode] = useState('');
  const [workOrderTitle, setWorkOrderTitle] = useState('');
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [analysisRequest, setAnalysisRequest] = useState(
    'Inspect the submitted evidence for consequential visible facts, preserve uncertainty, and request another view when the evidence is insufficient.',
  );
  const [analysisReceipts, setAnalysisReceipts] = useState<OpsAnalysisReceipt[]>([]);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const observationSpeech = useSpeechInput(
    'en-US',
    () => observationText,
    setObservationText,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const allCases = await listOpsInspectionCases(db);
        let matchingCases = allCases.filter(
          (candidate) =>
            candidate.playbookId === configuration.playbook.playbookId &&
            candidate.playbookVersion === configuration.playbook.version,
        );

        let selectedCase = matchingCases[0];
        if (!selectedCase) {
          const created = createAssetAndCase(configuration.playbook);
          await saveOpsCaseAndAsset(db, created.inspectionCase, created.asset);
          selectedCase = created.inspectionCase;
          matchingCases = [created.inspectionCase];
        }

        selectedCase = normalizeInspectionCase(selectedCase);
        let selectedAsset = selectedCase.assetId
          ? await loadOpsAssetPassport(db, selectedCase.assetId)
          : undefined;
        if (!selectedAsset) {
          selectedAsset = createAssetPassport({
            assetId: selectedCase.assetId ?? makeId('asset'),
            displayName: selectedCase.title || configuration.playbook.title,
            category: configuration.playbook.assetCategory,
            siteLabel: selectedCase.siteLabel,
            now: selectedCase.createdAt,
          });
          selectedCase = {
            ...selectedCase,
            assetId: selectedAsset.assetId,
            title: selectedAsset.displayName,
          };
          await saveOpsCaseAndAsset(db, selectedCase, selectedAsset);
          matchingCases = matchingCases.map((candidate) =>
            candidate.caseId === selectedCase?.caseId ? selectedCase! : candidate,
          );
        }

        const [nextArtifacts, nextObservations, nextWorkOrders, nextAnalysisReceipts] = await Promise.all([
          listOpsEvidenceArtifacts(db, selectedCase.caseId),
          listOpsObservations(db, selectedCase.caseId),
          listOpsWorkOrders(db, selectedCase.caseId),
          listOpsAnalysisReceipts(db, selectedCase.caseId),
        ]);

        if (!cancelled) {
          setCases(matchingCases);
          setInspectionCase(selectedCase);
          setAsset(selectedAsset);
          setAssetDraft(assetDraftFrom(selectedAsset));
          setArtifacts(nextArtifacts);
          setObservations(nextObservations);
          setWorkOrders(nextWorkOrders);
          setAnalysisReceipts(nextAnalysisReceipts);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, configuration.playbook.playbookId, configuration.playbook.version, archiveRevision]);

  const guidance = useMemo(
    () =>
      inspectionCase?.playbookId === configuration.playbook.playbookId &&
      inspectionCase.playbookVersion === configuration.playbook.version
        ? buildInspectionGuidance(configuration.playbook, inspectionCase)
        : null,
    [configuration.playbook, inspectionCase],
  );
  const decisionEvaluation = useMemo(
    () => evaluateDecisionCase(configuration.decisionCase),
    [configuration.decisionCase],
  );
  const missingRequiredFacts = configuration.playbook.factPrompts.filter(
    (prompt) =>
      prompt.required &&
      (inspectionCase?.facts[prompt.factKey] === undefined ||
        inspectionCase.facts[prompt.factKey] === null ||
        inspectionCase.facts[prompt.factKey] === ''),
  );

  function updateCaseInList(nextCase: OpsInspectionCase): void {
    setCases((current) =>
      [nextCase, ...current.filter((candidate) => candidate.caseId !== nextCase.caseId)].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
  }

  async function loadCase(caseId: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const stored = await loadOpsInspectionCase(db, caseId);
      if (!stored) throw new Error(`Inspection case ${caseId} is no longer available`);
      const nextCase = normalizeInspectionCase(stored);
      const nextAsset = nextCase.assetId ? await loadOpsAssetPassport(db, nextCase.assetId) : undefined;
      if (!nextAsset) throw new Error('The inspection case has no asset passport');
      const [nextArtifacts, nextObservations, nextWorkOrders, nextAnalysisReceipts] = await Promise.all([
        listOpsEvidenceArtifacts(db, caseId),
        listOpsObservations(db, caseId),
        listOpsWorkOrders(db, caseId),
        listOpsAnalysisReceipts(db, caseId),
      ]);

      setInspectionCase(nextCase);
      setAsset(nextAsset);
      setAssetDraft(assetDraftFrom(nextAsset));
      setArtifacts(nextArtifacts);
      setObservations(nextObservations);
      setWorkOrders(nextWorkOrders);
      setAnalysisReceipts(nextAnalysisReceipts);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  async function persistCase(nextCase: OpsInspectionCase): Promise<void> {
    setInspectionCase(nextCase);
    updateCaseInList(nextCase);
    setSaveState('saving');
    setError(null);
    try {
      await saveOpsInspectionCase(db, nextCase);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleAssetSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!inspectionCase || !asset || !assetDraft) return;
    const now = new Date().toISOString();
    try {
      const nextAsset = updateAssetPassport(asset, assetDraft, now);
      const nextCase: OpsInspectionCase = {
        ...inspectionCase,
        title: nextAsset.displayName,
        siteLabel: nextAsset.siteLabel,
        assetId: nextAsset.assetId,
        updatedAt: now,
      };
      setSaveState('saving');
      setError(null);
      await saveOpsCaseAndAsset(db, nextCase, nextAsset);
      setAsset(nextAsset);
      setAssetDraft(assetDraftFrom(nextAsset));
      setInspectionCase(nextCase);
      updateCaseInList(nextCase);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleFactChange(prompt: FactPrompt, raw: string): Promise<void> {
    if (!inspectionCase) return;
    const now = new Date().toISOString();
    const sourceClass =
      inspectionCase.factProvenance[prompt.factKey]?.sourceClass ?? 'operator_observed';
    const nextCase = setInspectionFact(
      inspectionCase,
      prompt.factKey,
      readFactControlValue(prompt, raw),
      now,
      { sourceClass },
    );
    await persistCase(nextCase);
  }

  async function handleFactSourceChange(
    prompt: FactPrompt,
    sourceClass: EvidenceSourceClass,
  ): Promise<void> {
    if (!inspectionCase) return;
    const nextCase = setInspectionFact(
      inspectionCase,
      prompt.factKey,
      inspectionCase.facts[prompt.factKey] ?? null,
      new Date().toISOString(),
      { sourceClass },
    );
    await persistCase(nextCase);
  }

  async function handleEvidenceFile(file: File, input: HTMLInputElement): Promise<void> {
    if (!inspectionCase || !guidance?.nextRequest) return;
    const request = guidance.nextRequest;
    const kind = inferEvidenceKind(file);
    if (
      !request.acceptedKinds.includes(kind) &&
      !(kind === 'photo' && request.acceptedKinds.includes('measurement'))
    ) {
      setError(`${request.label} does not accept ${kind} evidence`);
      input.value = '';
      return;
    }

    const capturedAt = new Date().toISOString();
    const artifact: EvidenceArtifact = {
      artifactId: makeId('evidence'),
      caseId: inspectionCase.caseId,
      requestId: request.requestId,
      kind,
      sourceClass:
        request.safety === 'licensed_trade' ? 'contractor_documented' : 'operator_observed',
      fileName: file.name || null,
      mimeType: file.type || null,
      sizeBytes: file.size,
      capturedAt,
      notes: null,
      blob: file,
    };
    const nextCase = completeCaptureRequest(
      inspectionCase,
      configuration.playbook,
      artifact,
      capturedAt,
    );
    const nextAsset = asset ? attachEvidenceToAsset(asset, artifact.artifactId, capturedAt) : undefined;

    setSaveState('saving');
    setError(null);
    try {
      await commitOpsEvidenceCapture(db, artifact, nextCase, nextAsset);
      setArtifacts((current) => [...current, artifact]);
      setInspectionCase(nextCase);
      updateCaseInList(nextCase);
      if (nextAsset) {
        setAsset(nextAsset);
        setAssetDraft(assetDraftFrom(nextAsset));
      }
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    } finally {
      input.value = '';
    }
  }

  async function handleSkip(): Promise<void> {
    if (!inspectionCase || !guidance?.nextRequest) return;
    const nextCase = skipCaptureRequest(
      inspectionCase,
      configuration.playbook,
      guidance.nextRequest.requestId,
      'Not safely or practically available during this inspection',
    );
    await persistCase(nextCase);
  }

  async function handleReadyForReview(): Promise<void> {
    if (!inspectionCase) return;
    try {
      await persistCase(markInspectionReadyForReview(inspectionCase, configuration.playbook));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAddObservation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!inspectionCase || observationText.trim().length === 0) return;
    const observation = createObservation({
      observationId: makeId('observation'),
      caseId: inspectionCase.caseId,
      assetId: inspectionCase.assetId,
      kind: observationKind,
      text: observationText,
      sourceClass: observationSource,
      sourceLabel: observationSourceLabel,
      evidenceArtifactIds: observationEvidenceId ? [observationEvidenceId] : [],
    });

    setSaveState('saving');
    setError(null);
    try {
      await saveOpsObservation(db, observation);
      setObservations((current) => [...current, observation]);
      setObservationText('');
      setObservationSourceLabel('');
      setObservationEvidenceId('');
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleCreateWorkOrder(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!inspectionCase) return;
    setSaveState('saving');
    setError(null);
    try {
      let nextWorkOrder = createWorkOrder({
        workOrderId: makeId('work'),
        caseId: inspectionCase.caseId,
        assetId: inspectionCase.assetId,
        issueCode: workOrderIssueCode,
        title: workOrderTitle,
      });
      const allWorkOrders = await listAllOpsWorkOrders(db);
      nextWorkOrder = linkRecurrence(
        nextWorkOrder,
        findRecurrenceMatches(nextWorkOrder, allWorkOrders),
      );
      await saveOpsWorkOrder(db, nextWorkOrder);
      setWorkOrders((current) => [nextWorkOrder, ...current]);
      setWorkOrderIssueCode('');
      setWorkOrderTitle('');
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleWorkOrderTransition(
    workOrder: OpsWorkOrder,
    input: WorkOrderTransitionInput,
  ): Promise<void> {
    setSaveState('saving');
    setError(null);
    try {
      const nextWorkOrder = transitionWorkOrder(workOrder, input);
      await saveOpsWorkOrder(db, nextWorkOrder);
      setWorkOrders((current) =>
        current.map((candidate) =>
          candidate.workOrderId === nextWorkOrder.workOrderId ? nextWorkOrder : candidate,
        ),
      );
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleOpsExport(): Promise<void> {
    setError(null);
    try {
      const archive = await exportOpsArchive(db);
      downloadText(
        `wolf-ops-${new Date().toISOString().slice(0, 10)}.wolfops.json`,
        'application/json',
        JSON.stringify(archive, null, 2),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpsImport(file: File, input: HTMLInputElement): Promise<void> {
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!window.confirm('Replace all local WOLF Ops data with this backup? Testimony records are not affected.')) {
        return;
      }
      setLoading(true);
      await importOpsArchive(db, parsed);
      setArchiveRevision((current) => current + 1);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    } finally {
      input.value = '';
    }
  }

  async function deliverAnalysisSubmission(submission: OpsAnalysisSubmission): Promise<void> {
    const text = JSON.stringify(submission, null, 2);
    const filename = `${submission.caseId}-${submission.submissionId}.wolfhandoff.json`;
    const file = new File([text], filename, { type: 'application/json' });
    const shareNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof navigator.share === 'function' && shareNavigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'WOLF analysis handoff', text: analysisRequest, files: [file] });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    downloadText(filename, 'application/json', text);
  }

  async function handleCreateAnalysisSubmission(): Promise<void> {
    if (!inspectionCase) return;
    setError(null);
    setAnalysisNotice(null);
    setSaveState('saving');
    try {
      const submission = await createOpsAnalysisSubmission(
        db,
        inspectionCase.caseId,
        analysisRequest,
      );
      await deliverAnalysisSubmission(submission);
      setAnalysisNotice(
        `Frozen submission ${submission.submissionId} was prepared. This live case remains writable.`,
      );
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleAnalysisReturn(file: File, input: HTMLInputElement): Promise<void> {
    if (!inspectionCase) return;
    setError(null);
    setAnalysisNotice(null);
    try {
      const result = await importOpsAnalysisReturn(db, JSON.parse(await file.text()) as unknown);
      const [nextObservations, nextReceipts] = await Promise.all([
        listOpsObservations(db, inspectionCase.caseId),
        listOpsAnalysisReceipts(db, inspectionCase.caseId),
      ]);
      setObservations(nextObservations);
      setAnalysisReceipts(nextReceipts);
      setAnalysisNotice(
        result.alreadyImported
          ? 'That analysis return was already imported; no duplicate claims were created.'
          : result.receipt.caseAdvancedSinceSubmission
            ? 'Analysis imported against its frozen snapshot. Newer local work was preserved and the result is marked as based on an earlier revision.'
            : 'Analysis imported for review without replacing local work.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      input.value = '';
    }
  }

  async function handleAnalysisReview(
    observation: OpsObservation,
    review: 'accepted' | 'rejected',
  ): Promise<void> {
    setError(null);
    try {
      const next = await reviewAnalysisObservation(db, observation.observationId, review);
      setObservations((current) =>
        current.map((candidate) => candidate.observationId === next.observationId ? next : candidate),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleNewAssetInspection(): Promise<void> {
    const created = createAssetAndCase(configuration.playbook);
    setSaveState('saving');
    setError(null);
    try {
      await saveOpsCaseAndAsset(db, created.inspectionCase, created.asset);
      setCases((current) => [created.inspectionCase, ...current]);
      setInspectionCase(created.inspectionCase);
      setAsset(created.asset);
      setAssetDraft(assetDraftFrom(created.asset));
      setArtifacts([]);
      setObservations([]);
      setWorkOrders([]);
      setAnalysisReceipts([]);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleNewInspectionForAsset(): Promise<void> {
    if (!asset) return;
    const now = new Date().toISOString();
    const nextCase = createInspectionCase({
      caseId: makeId('case'),
      playbook: configuration.playbook,
      title: asset.displayName,
      siteLabel: asset.siteLabel,
      assetId: asset.assetId,
      now,
    });
    setSaveState('saving');
    setError(null);
    try {
      await saveOpsInspectionCase(db, nextCase);
      setCases((current) => [nextCase, ...current]);
      setInspectionCase(nextCase);
      setArtifacts([]);
      setObservations([]);
      setWorkOrders([]);
      setAnalysisReceipts([]);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  async function handleReset(): Promise<void> {
    if (!inspectionCase || !asset) return;
    const confirmed = window.confirm(
      'Delete this local inspection, its observations, and all evidence captured for it? The asset passport will remain.',
    );
    if (!confirmed) return;
    setSaveState('saving');
    setError(null);
    try {
      await deleteOpsInspectionCase(db, inspectionCase.caseId);
      const removedEvidenceIds = new Set(artifacts.map((artifact) => artifact.artifactId));
      const now = new Date().toISOString();
      const cleanedAsset: OpsAssetPassport = {
        ...asset,
        evidenceArtifactIds: asset.evidenceArtifactIds.filter(
          (artifactId) => !removedEvidenceIds.has(artifactId),
        ),
        updatedAt: now,
      };
      const nextCase = createInspectionCase({
        caseId: makeId('case'),
        playbook: configuration.playbook,
        title: cleanedAsset.displayName,
        siteLabel: cleanedAsset.siteLabel,
        assetId: cleanedAsset.assetId,
        now,
      });
      await saveOpsCaseAndAsset(db, nextCase, cleanedAsset);
      setCases((current) => [
        nextCase,
        ...current.filter((candidate) => candidate.caseId !== inspectionCase.caseId),
      ]);
      setInspectionCase(nextCase);
      setAsset(cleanedAsset);
      setAssetDraft(assetDraftFrom(cleanedAsset));
      setArtifacts([]);
      setObservations([]);
      setWorkOrders([]);
      setAnalysisReceipts([]);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  if (loading) return <p>Loading WOLF Ops…</p>;
  if (!inspectionCase || !guidance || !asset || !assetDraft) {
    return (
      <p role="alert" className="notice">
        Could not open the local inspection.
      </p>
    );
  }

  const resolvedCount = guidance.completedRequests.length + guidance.skippedRequests.length;
  const eligibleCount = resolvedCount + guidance.pendingRequests.length;
  const cameraCapture = guidance.nextRequest?.acceptedKinds.some(
    (kind) => kind === 'photo' || kind === 'video',
  );

  return (
    <div className="stack ops-screen">
      <header className="ops-heading">
        <div>
          <p className="meta">WOLF OPS · GUIDED LOCAL INSPECTION</p>
          <h1>See the system before choosing the fix</h1>
          <p>
            WOLF asks for one consequential observation at a time, preserves the evidence locally,
            and keeps the durable option range visible.
          </p>
        </div>
        <span className="status-pill">{statusLabel(inspectionCase.status)}</span>
      </header>

      <p className="notice">
        Media stays in this browser profile. Avoid faces, private papers, credentials, and unrelated
        belongings. This build organizes evidence and decision branches locally; it does not yet infer
        facts from image pixels.
      </p>

      <section className="card stack" aria-labelledby="ops-backup-heading">
        <div>
          <p className="meta">PORTABLE LOCAL CUSTODY</p>
          <h2 id="ops-backup-heading">Back up or restore WOLF Ops</h2>
          <p className="muted">
            The backup includes asset passports, inspections, sourced observations, work orders,
            and original local media. Restoring replaces WOLF Ops data only; testimony is untouched.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => void handleOpsExport()}>
            Export Ops backup
          </button>
          <label className="btn btn--secondary" htmlFor="ops-backup-file">Restore Ops backup</label>
          <input
            className="visually-hidden"
            id="ops-backup-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (file) void handleOpsImport(file, input);
            }}
          />
        </div>
      </section>

      <section className="card stack" aria-labelledby="analysis-exchange-heading">
        <div>
          <p className="meta">ASYNCHRONOUS ANALYSIS EXCHANGE</p>
          <h2 id="analysis-exchange-heading">Send a frozen copy; keep working</h2>
          <p className="muted">
            A handoff copies this case and its evidence for outside analysis. Your live inspection
            remains editable. Returned claims append in review status and never overwrite newer work.
          </p>
        </div>
        <div className="ops-field">
          <label htmlFor="analysis-request">What should the analyst resolve?</label>
          <textarea id="analysis-request" rows={3} value={analysisRequest} onChange={(event) => setAnalysisRequest(event.target.value)} />
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => void handleCreateAnalysisSubmission()}>
            Send for analysis
          </button>
          <label className="btn btn--secondary" htmlFor="analysis-return-file">Import analysis return</label>
          <input
            className="visually-hidden"
            id="analysis-return-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (file) void handleAnalysisReturn(file, input);
            }}
          />
        </div>
        <p className="notice">
          Handoff files contain unencrypted operational evidence. Send them only through a channel
          appropriate for the material.
        </p>
        {analysisNotice ? <p role="status" className="notice">{analysisNotice}</p> : null}
        {analysisReceipts.map((receipt) => (
          <details key={receipt.responseId}>
            <summary>
              Analysis from {receipt.analysisReturn.analyst} · {receipt.analysisReturn.claims.length} claims
              {receipt.caseAdvancedSinceSubmission ? ' · earlier snapshot' : ''}
            </summary>
            {receipt.analysisReturn.warnings.length > 0 ? <><h3>Warnings</h3><ul>{receipt.analysisReturn.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></> : null}
            {receipt.analysisReturn.nextEvidenceRequests.length > 0 ? <><h3>Requested follow-up evidence</h3><ul>{receipt.analysisReturn.nextEvidenceRequests.map((request) => <li key={request.requestId}><strong>{request.label}</strong>: {request.instruction} <span className="meta">{request.purpose}</span></li>)}</ul></> : null}
          </details>
        ))}
      </section>

      <div className="ops-toolbar">
        <div className="ops-field">
          <label htmlFor="ops-playbook">Inspection configuration</label>
          <select
            id="ops-playbook"
            value={playbookId}
            onChange={(event) => {
              setLoading(true);
              setPlaybookId(event.target.value);
            }}
          >
            {CONFIGURATIONS.map(({ playbook }) => (
              <option key={playbook.playbookId} value={playbook.playbookId}>
                {playbook.title}
              </option>
            ))}
          </select>
        </div>
        <div className="ops-field">
          <label htmlFor="ops-case">Inspection case</label>
          <select
            id="ops-case"
            value={inspectionCase.caseId}
            onChange={(event) => void loadCase(event.target.value)}
          >
            {cases.map((candidate) => (
              <option key={candidate.caseId} value={candidate.caseId}>
                {candidate.title} · {statusLabel(candidate.status)}
              </option>
            ))}
          </select>
        </div>
        <p className="meta" role="status" aria-live="polite">
          {saveState === 'saving'
            ? 'Saving locally…'
            : saveState === 'saved'
              ? 'Saved locally'
              : 'Local case'}
        </p>
      </div>

      <div className="row">
        <button type="button" className="btn btn--secondary" onClick={() => void handleNewAssetInspection()}>
          New asset inspection
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void handleNewInspectionForAsset()}>
          New inspection for this asset
        </button>
      </div>

      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}

      <section className="card stack" aria-labelledby="asset-heading">
        <div>
          <p className="meta">ASSET PASSPORT · {asset.category}</p>
          <h2 id="asset-heading">What this equipment actually is</h2>
          <p className="muted">
            The stable asset record survives individual complaints and inspections. Unknown fields can
            remain unknown until evidence resolves them.
          </p>
        </div>
        <form className="stack" onSubmit={(event) => void handleAssetSave(event)}>
          <div className="ops-fact-grid">
            <div className="ops-field">
              <label htmlFor="asset-name">Asset or system name *</label>
              <input
                id="asset-name"
                value={assetDraft.displayName}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, displayName: event.target.value } : current,
                  )
                }
                required
              />
            </div>
            <div className="ops-field">
              <label htmlFor="asset-site">Site</label>
              <input
                id="asset-site"
                value={assetDraft.siteLabel ?? ''}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, siteLabel: event.target.value } : current,
                  )
                }
                placeholder="Shop, property, or building"
              />
            </div>
            <div className="ops-field">
              <label htmlFor="asset-location">Exact location</label>
              <input
                id="asset-location"
                value={assetDraft.locationLabel ?? ''}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, locationLabel: event.target.value } : current,
                  )
                }
                placeholder="Unit B living room or front counter"
              />
            </div>
            <div className="ops-field">
              <label htmlFor="asset-manufacturer">Manufacturer</label>
              <input
                id="asset-manufacturer"
                value={assetDraft.manufacturer ?? ''}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, manufacturer: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="ops-field">
              <label htmlFor="asset-model">Model</label>
              <input
                id="asset-model"
                value={assetDraft.model ?? ''}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, model: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="ops-field">
              <label htmlFor="asset-serial">Serial number</label>
              <input
                id="asset-serial"
                value={assetDraft.serialNumber ?? ''}
                onChange={(event) =>
                  setAssetDraft((current) =>
                    current ? { ...current, serialNumber: event.target.value } : current,
                  )
                }
              />
            </div>
          </div>
          <div className="row">
            <button type="submit" className="btn">
              Save asset passport
            </button>
            <span className="meta">{asset.evidenceArtifactIds.length} linked evidence artifacts</span>
          </div>
        </form>
      </section>

      <section className="card stack" aria-labelledby="facts-heading">
        <div>
          <h2 id="facts-heading">Branch-changing facts</h2>
          <p className="muted">
            These answers decide which evidence requests become live. Unknown is preserved as unknown,
            and each answer keeps its source class.
          </p>
        </div>
        <div className="ops-fact-grid">
          {configuration.playbook.factPrompts.map((prompt) => {
            const factSource =
              inspectionCase.factProvenance[prompt.factKey]?.sourceClass ?? 'operator_observed';
            return (
              <div className="ops-field ops-fact" key={prompt.factKey}>
                <label htmlFor={`fact-${prompt.factKey}`}>
                  {prompt.label}
                  {prompt.required ? ' *' : ''}
                </label>
                {prompt.kind === 'text' ? (
                  <input
                    id={`fact-${prompt.factKey}`}
                    type="text"
                    value={writeFactControlValue(prompt, inspectionCase.facts[prompt.factKey])}
                    onChange={(event) => void handleFactChange(prompt, event.target.value)}
                  />
                ) : (
                  <select
                    id={`fact-${prompt.factKey}`}
                    value={writeFactControlValue(prompt, inspectionCase.facts[prompt.factKey])}
                    onChange={(event) => void handleFactChange(prompt, event.target.value)}
                  >
                    <option value="">Unknown</option>
                    {prompt.kind === 'boolean' ? (
                      <>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </>
                    ) : (
                      prompt.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                )}
                <label htmlFor={`fact-source-${prompt.factKey}`}>Source</label>
                <select
                  id={`fact-source-${prompt.factKey}`}
                  value={factSource}
                  onChange={(event) =>
                    void handleFactSourceChange(prompt, event.target.value as EvidenceSourceClass)
                  }
                >
                  {HUMAN_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {prompt.help ? <p className="meta">{prompt.help}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      {guidance.blockers.map((blocker) => (
        <section className="notice ops-blocker" role="alert" key={blocker.ruleId}>
          <h2>{blocker.label}</h2>
          <p>{blocker.message}</p>
        </section>
      ))}

      <section className="card stack" aria-labelledby="next-view-heading">
        <div className="row ops-progress-row">
          <div>
            <p className="meta">
              {resolvedCount} of {eligibleCount} live evidence requests resolved
            </p>
            <h2 id="next-view-heading">What WOLF needs to see next</h2>
          </div>
          {missingRequiredFacts.length > 0 ? (
            <span className="status-pill">
              {missingRequiredFacts.length} required facts unknown
            </span>
          ) : null}
        </div>

        {guidance.nextRequest ? (
          <div className="ops-next-request">
            <div className="row">
              <span className="field-chip">{guidance.nextRequest.priority}</span>
              <span className="field-chip">
                {guidance.nextRequest.safety.replaceAll('_', ' ')}
              </span>
            </div>
            <h3>{guidance.nextRequest.label}</h3>
            <p>{guidance.nextRequest.instruction}</p>
            <p className="meta">Why this view: {guidance.nextRequest.purpose}</p>
            <div className="row">
              <label className="btn ops-file-button" htmlFor="ops-evidence-file">
                Take or attach {guidance.nextRequest.acceptedKinds.join(' / ')}
              </label>
              <input
                className="visually-hidden"
                id="ops-evidence-file"
                type="file"
                accept={acceptForRequest(guidance.nextRequest)}
                capture={cameraCapture ? 'environment' : undefined}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (file) void handleEvidenceFile(file, input);
                }}
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void handleSkip()}
              >
                Defer with reason
              </button>
            </div>
          </div>
        ) : guidance.blockers.some((blocker) => blocker.blocksCapture) ? (
          <p>Ordinary capture is paused until the safety branch is resolved.</p>
        ) : guidance.readyForReview ? (
          <div className="stack">
            <p>
              All currently live requests are captured or explicitly deferred. The case can move to
              review without pretending deferred evidence was observed.
            </p>
            <button type="button" className="btn" onClick={() => void handleReadyForReview()}>
              Mark ready for review
            </button>
          </div>
        ) : (
          <p>Answer the required branch-changing facts to generate the next evidence request.</p>
        )}
      </section>

      <section className="stack" aria-labelledby="evidence-heading">
        <div className="row ops-progress-row">
          <div>
            <h2 id="evidence-heading">Local evidence</h2>
            <p className="muted">
              Each artifact remains tied to the request it was meant to resolve.
            </p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => void handleReset()}>
            Reset this inspection
          </button>
        </div>
        {artifacts.length === 0 ? (
          <p className="notice">No media has been captured for this inspection yet.</p>
        ) : (
          <ul className="ops-evidence-grid">
            {artifacts.map((artifact) => {
              const request = configuration.playbook.captureRequests.find(
                (candidate) => candidate.requestId === artifact.requestId,
              );
              return (
                <li className="card stack" key={artifact.artifactId}>
                  <EvidencePreview artifact={artifact} label={request?.label ?? artifact.requestId} />
                  <div>
                    <h3>{request?.label ?? artifact.requestId}</h3>
                    <p className="meta">
                      {artifact.fileName ?? artifact.kind} · {sourceLabel(artifact.sourceClass)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="observation-heading">
        <div>
          <p className="meta">SOURCE-SEPARATED LEDGER</p>
          <h2 id="observation-heading">What is known, reported, or documented</h2>
          <p className="muted">
            A report, direct observation, document, measurement, and later inference remain different
            objects even when they concern the same symptom.
          </p>
        </div>
        <form className="stack" onSubmit={(event) => void handleAddObservation(event)}>
          <div className="ops-fact-grid">
            <div className="ops-field">
              <label htmlFor="observation-kind">Observation kind</label>
              <select
                id="observation-kind"
                value={observationKind}
                onChange={(event) => setObservationKind(event.target.value as ObservationKind)}
              >
                {OBSERVATION_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="observation-source">Source class</label>
              <select
                id="observation-source"
                value={observationSource}
                onChange={(event) =>
                  setObservationSource(event.target.value as EvidenceSourceClass)
                }
              >
                {HUMAN_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="observation-source-label">Who or what supplied it</label>
              <input
                id="observation-source-label"
                value={observationSourceLabel}
                onChange={(event) => setObservationSourceLabel(event.target.value)}
                placeholder="Current occupant, contractor, invoice, manual"
              />
            </div>
            <div className="ops-field">
              <label htmlFor="observation-evidence">Linked evidence</label>
              <select
                id="observation-evidence"
                value={observationEvidenceId}
                onChange={(event) => setObservationEvidenceId(event.target.value)}
              >
                <option value="">No artifact linked</option>
                {artifacts.map((artifact) => (
                  <option key={artifact.artifactId} value={artifact.artifactId}>
                    {artifact.fileName ?? artifact.requestId}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ops-field">
            <label htmlFor="observation-text">Observation or report</label>
            <textarea
              id="observation-text"
              rows={4}
              value={observationText}
              onChange={(event) => setObservationText(event.target.value)}
              placeholder="Record the claim precisely without converting interpretation into fact."
              required
            />
            {observationSpeech.supported ? (
              <div className="stack">
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={observationSpeech.listening ? observationSpeech.stop : observationSpeech.start}
                  >
                    {observationSpeech.listening ? 'Stop listening' : 'Speak observation'}
                  </button>
                  <span className="meta" role="status" aria-live="polite">
                    {observationSpeech.listening ? 'Listening; transcript remains editable and is not saved automatically.' : 'Browser speech may use a network service.'}
                  </span>
                </div>
                {observationSpeech.error ? <p role="alert" className="notice">Speech input failed: {observationSpeech.error.replaceAll('-', ' ')}</p> : null}
              </div>
            ) : null}
          </div>
          <button type="submit" className="btn">
            Add to observation ledger
          </button>
        </form>

        {observations.length === 0 ? (
          <p className="notice">No sourced observations have been recorded for this case.</p>
        ) : (
          <ol className="ops-observation-list">
            {observations.map((observation) => (
              <li className="ops-observation" key={observation.observationId}>
                <div className="row">
                  <span className="field-chip">{observation.kind.replaceAll('_', ' ')}</span>
                  <span className="field-chip">{sourceLabel(observation.sourceClass)}</span>
                  <span className="field-chip">{observation.confidence}</span>
                  {observation.analysisReviewStatus ? <span className="field-chip">analysis {observation.analysisReviewStatus}</span> : null}
                </div>
                <p>{observation.text}</p>
                <p className="meta">
                  {observation.sourceLabel ?? 'Source not named'} · {observation.observedAt}
                  {observation.evidenceArtifactIds.length > 0
                    ? ` · ${observation.evidenceArtifactIds.length} linked artifact`
                    : ''}
                </p>
                {observation.analysisReviewStatus === 'pending' ? (
                  <div className="row">
                    <button type="button" className="btn" onClick={() => void handleAnalysisReview(observation, 'accepted')}>Accept as reviewed residue</button>
                    <button type="button" className="btn btn--secondary" onClick={() => void handleAnalysisReview(observation, 'rejected')}>Reject claim</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="stack" aria-labelledby="work-orders-heading">
        <div>
          <p className="meta">EXECUTION LEDGER · NO FALSE CLOSURE</p>
          <h2 id="work-orders-heading">Work orders and durable verification</h2>
          <p className="muted">
            Temporary stabilization stays open. Verification requires a named test and captured
            evidence; closure requires completed follow-up.
          </p>
        </div>
        <form className="card stack" onSubmit={(event) => void handleCreateWorkOrder(event)}>
          <div className="ops-fact-grid">
            <div className="ops-field">
              <label htmlFor="work-order-issue">Stable issue code</label>
              <input id="work-order-issue" value={workOrderIssueCode} onChange={(event) => setWorkOrderIssueCode(event.target.value)} placeholder="lighting.intermittent" required />
            </div>
            <div className="ops-field">
              <label htmlFor="work-order-title">Work-order title</label>
              <input id="work-order-title" value={workOrderTitle} onChange={(event) => setWorkOrderTitle(event.target.value)} placeholder="Diagnose intermittent room lighting" required />
            </div>
          </div>
          <button type="submit" className="btn">Open work order</button>
        </form>
        {workOrders.length === 0 ? <p className="notice">No work orders are linked to this inspection.</p> : workOrders.map((workOrder) => (
          <WorkOrderCard
            key={workOrder.workOrderId}
            workOrder={workOrder}
            artifacts={artifacts}
            onTransition={(input) => handleWorkOrderTransition(workOrder, input)}
          />
        ))}
      </section>

      <section className="stack" aria-labelledby="options-heading">
        <div>
          <p className="meta">
            DECISION RANGE · ILLUSTRATIVE UNTIL LOCAL EVIDENCE REPLACES THE PRIORS
          </p>
          <h2 id="options-heading">{configuration.decisionCase.title}</h2>
          <p>{configuration.decisionCase.context}</p>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-option-table">
            <thead>
              <tr>
                <th scope="col">Path</th>
                {configuration.decisionCase.metrics.map((metric) => (
                  <th scope="col" key={metric.metricId}>
                    {metric.label}
                  </th>
                ))}
                <th scope="col">Evidence-adjusted score</th>
              </tr>
            </thead>
            <tbody>
              {decisionEvaluation.options.map((option) => (
                <tr
                  key={option.optionId}
                  className={option.onParetoFrontier ? 'ops-frontier' : undefined}
                >
                  <th scope="row">
                    {option.label}
                    {option.onParetoFrontier ? (
                      <span className="status-pill status-pill--positive">non-dominated</span>
                    ) : null}
                  </th>
                  {configuration.decisionCase.metrics.map((metric) => (
                    <td key={metric.metricId}>
                      {option.metricValues[metric.metricId] ?? 'unknown'}
                    </td>
                  ))}
                  <td>
                    {option.weightedScore === null
                      ? 'unknown'
                      : `${Math.round(option.weightedScore * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ops-option-cards">
          {decisionEvaluation.options.map((option) => (
            <details className="card" key={option.optionId}>
              <summary>
                <strong>{option.label}</strong>
                {option.onParetoFrontier ? ' · non-dominated under current values' : ''}
              </summary>
              <p>{option.summary}</p>
              <div className="ops-tradeoff-grid">
                <div>
                  <h3>Benefits</h3>
                  <ul>
                    {option.benefits.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Burdens</h3>
                  <ul>
                    {option.burdens.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Assumptions</h3>
                  <ul>
                    {option.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Reopen this path when</h3>
                  <ul>
                    {option.reopeningTriggers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function EvidencePreview({ artifact, label }: { artifact: EvidenceArtifact; label: string }): JSX.Element | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact.blob || typeof URL.createObjectURL !== 'function') return undefined;
    const objectUrl = URL.createObjectURL(artifact.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [artifact.blob]);

  if (!url) return null;
  if (artifact.kind === 'photo') {
    return <img className="ops-preview" src={url} alt={label} />;
  }
  if (artifact.kind === 'video') {
    return (
      <video
        className="ops-preview"
        src={url}
        controls
        preload="metadata"
        aria-label={label}
      />
    );
  }
  return null;
}
