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
  evaluateDecisionCase,
  markInspectionReadyForReview,
  recessedLightingDecisionCase,
  recessedLightingPlaybook,
  setInspectionFact,
  skipCaptureRequest,
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
  type ScalarFact,
} from '../../ops/index.js';
import {
  commitOpsEvidenceCapture,
  deleteOpsInspectionCase,
  listOpsEvidenceArtifacts,
  listOpsInspectionCases,
  listOpsObservations,
  loadOpsAssetPassport,
  loadOpsInspectionCase,
  saveOpsCaseAndAsset,
  saveOpsInspectionCase,
  saveOpsObservation,
  type WolfDb,
} from '../../storage/index.js';
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

function statusLabel(status: OpsInspectionCase['status']): string {
  return status.replaceAll('_', ' ');
}

function sourceLabel(sourceClass: EvidenceSourceClass): string {
  return (
    HUMAN_SOURCE_OPTIONS.find((option) => option.value === sourceClass)?.label ??
    sourceClass.replaceAll('_', ' ')
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
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

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

        const [nextArtifacts, nextObservations] = await Promise.all([
          listOpsEvidenceArtifacts(db, selectedCase.caseId),
          listOpsObservations(db, selectedCase.caseId),
        ]);

        if (!cancelled) {
          setCases(matchingCases);
          setInspectionCase(selectedCase);
          setAsset(selectedAsset);
          setAssetDraft(assetDraftFrom(selectedAsset));
          setArtifacts(nextArtifacts);
          setObservations(nextObservations);
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
  }, [db, configuration.playbook.playbookId, configuration.playbook.version]);

  const guidance = useMemo(
    () => (inspectionCase ? buildInspectionGuidance(configuration.playbook, inspectionCase) : null),
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
      const [nextArtifacts, nextObservations] = await Promise.all([
        listOpsEvidenceArtifacts(db, caseId),
        listOpsObservations(db, caseId),
      ]);

      setInspectionCase(nextCase);
      setAsset(nextAsset);
      setAssetDraft(assetDraftFrom(nextAsset));
      setArtifacts(nextArtifacts);
      setObservations(nextObservations);
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

      <div className="ops-toolbar">
        <div className="ops-field">
          <label htmlFor="ops-playbook">Inspection configuration</label>
          <select
            id="ops-playbook"
            value={playbookId}
            onChange={(event) => setPlaybookId(event.target.value)}
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
                </div>
                <p>{observation.text}</p>
                <p className="meta">
                  {observation.sourceLabel ?? 'Source not named'} · {observation.observedAt}
                  {observation.evidenceArtifactIds.length > 0
                    ? ` · ${observation.evidenceArtifactIds.length} linked artifact`
                    : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
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
