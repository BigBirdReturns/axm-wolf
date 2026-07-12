import { useEffect, useMemo, useState } from 'react';

import {
  buildInspectionGuidance,
  cafeDisplayDecisionCase,
  cafeDisplayPlaybook,
  completeCaptureRequest,
  createInspectionCase,
  evaluateDecisionCase,
  markInspectionReadyForReview,
  recessedLightingDecisionCase,
  recessedLightingPlaybook,
  setInspectionFact,
  skipCaptureRequest,
  type CaptureRequest,
  type DecisionCase,
  type EvidenceArtifact,
  type EvidenceKind,
  type FactPrompt,
  type InspectionPlaybook,
  type OpsInspectionCase,
  type ScalarFact,
} from '../../ops/index.js';
import {
  commitOpsEvidenceCapture,
  deleteOpsInspectionCase,
  listOpsEvidenceArtifacts,
  loadOpsInspectionCase,
  saveOpsInspectionCase,
  type WolfDb,
} from '../../storage/index.js';
import '../styles/ops.css';

type OpsConfiguration = {
  playbook: InspectionPlaybook;
  decisionCase: DecisionCase;
};

const CONFIGURATIONS: OpsConfiguration[] = [
  { playbook: recessedLightingPlaybook, decisionCase: recessedLightingDecisionCase },
  { playbook: cafeDisplayPlaybook, decisionCase: cafeDisplayDecisionCase },
];

function configurationFor(playbookId: string): OpsConfiguration {
  return CONFIGURATIONS.find((configuration) => configuration.playbook.playbookId === playbookId) ?? CONFIGURATIONS[0]!;
}

function caseIdFor(playbook: InspectionPlaybook): string {
  return `ops.${playbook.playbookId}.${playbook.version}`;
}

function makeId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function inferEvidenceKind(file: File): EvidenceKind {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

function acceptForRequest(request: CaptureRequest): string {
  const values = new Set<string>();
  if (request.acceptedKinds.includes('photo') || request.acceptedKinds.includes('measurement')) values.add('image/*');
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

export function OpsScreen({ db }: { db: WolfDb }): JSX.Element {
  const [playbookId, setPlaybookId] = useState(recessedLightingPlaybook.playbookId);
  const configuration = configurationFor(playbookId);
  const [inspectionCase, setInspectionCase] = useState<OpsInspectionCase | null>(null);
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const caseId = caseIdFor(configuration.playbook);
        let nextCase = await loadOpsInspectionCase(db, caseId);
        if (!nextCase) {
          nextCase = createInspectionCase({ caseId, playbook: configuration.playbook });
          await saveOpsInspectionCase(db, nextCase);
        }
        const nextArtifacts = await listOpsEvidenceArtifacts(db, caseId);
        if (!cancelled) {
          setInspectionCase(nextCase);
          setArtifacts(nextArtifacts);
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
    (prompt) => prompt.required && (inspectionCase?.facts[prompt.factKey] === undefined || inspectionCase.facts[prompt.factKey] === null || inspectionCase.facts[prompt.factKey] === ''),
  );

  async function persistCase(nextCase: OpsInspectionCase): Promise<void> {
    setInspectionCase(nextCase);
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

  async function handleFactChange(prompt: FactPrompt, raw: string): Promise<void> {
    if (!inspectionCase) return;
    const nextCase = setInspectionFact(
      inspectionCase,
      prompt.factKey,
      readFactControlValue(prompt, raw),
    );
    await persistCase(nextCase);
  }

  async function handleEvidenceFile(file: File, input: HTMLInputElement): Promise<void> {
    if (!inspectionCase || !guidance?.nextRequest) return;
    const request = guidance.nextRequest;
    const kind = inferEvidenceKind(file);
    if (!request.acceptedKinds.includes(kind) && !(kind === 'photo' && request.acceptedKinds.includes('measurement'))) {
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
      sourceClass: request.safety === 'licensed_trade' ? 'contractor_documented' : 'operator_observed',
      fileName: file.name || null,
      mimeType: file.type || null,
      sizeBytes: file.size,
      capturedAt,
      notes: null,
      blob: file,
    };
    const nextCase = completeCaptureRequest(inspectionCase, configuration.playbook, artifact, capturedAt);

    setSaveState('saving');
    setError(null);
    try {
      await commitOpsEvidenceCapture(db, artifact, nextCase);
      setArtifacts((current) => [...current, artifact]);
      setInspectionCase(nextCase);
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

  async function handleReset(): Promise<void> {
    if (!inspectionCase) return;
    const confirmed = window.confirm('Delete this local inspection and all evidence captured for it?');
    if (!confirmed) return;
    setSaveState('saving');
    setError(null);
    try {
      await deleteOpsInspectionCase(db, inspectionCase.caseId);
      const nextCase = createInspectionCase({
        caseId: caseIdFor(configuration.playbook),
        playbook: configuration.playbook,
      });
      await saveOpsInspectionCase(db, nextCase);
      setInspectionCase(nextCase);
      setArtifacts([]);
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('idle');
    }
  }

  if (loading) return <p>Loading WOLF Ops…</p>;
  if (!inspectionCase || !guidance) {
    return <p role="alert" className="notice">Could not open the local inspection.</p>;
  }

  const resolvedCount = guidance.completedRequests.length + guidance.skippedRequests.length;
  const eligibleCount = resolvedCount + guidance.pendingRequests.length;
  const cameraCapture = guidance.nextRequest?.acceptedKinds.some((kind) => kind === 'photo' || kind === 'video');

  return (
    <div className="stack ops-screen">
      <header className="ops-heading">
        <div>
          <p className="meta">WOLF OPS · GUIDED LOCAL INSPECTION</p>
          <h1>See the system before choosing the fix</h1>
          <p>
            WOLF asks for one consequential observation at a time, preserves the evidence locally, and keeps the durable option range visible.
          </p>
        </div>
        <span className="status-pill">{statusLabel(inspectionCase.status)}</span>
      </header>

      <p className="notice">
        Media stays in this browser profile. Avoid faces, private papers, credentials, and unrelated belongings. This build organizes evidence and decision branches locally; it does not yet infer facts from image pixels.
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
              <option key={playbook.playbookId} value={playbook.playbookId}>{playbook.title}</option>
            ))}
          </select>
        </div>
        <p className="meta" role="status" aria-live="polite">
          {saveState === 'saving' ? 'Saving locally…' : saveState === 'saved' ? 'Saved locally' : 'Local case'}
        </p>
      </div>

      {error ? <p role="alert" className="notice">{error}</p> : null}

      <section className="card stack" aria-labelledby="facts-heading">
        <div>
          <h2 id="facts-heading">Branch-changing facts</h2>
          <p className="muted">These answers decide which evidence requests become live. Unknown is preserved as unknown.</p>
        </div>
        <div className="ops-fact-grid">
          {configuration.playbook.factPrompts.map((prompt) => (
            <div className="ops-field" key={prompt.factKey}>
              <label htmlFor={`fact-${prompt.factKey}`}>{prompt.label}{prompt.required ? ' *' : ''}</label>
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
                  ) : prompt.options?.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
              {prompt.help ? <p className="meta">{prompt.help}</p> : null}
            </div>
          ))}
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
            <p className="meta">{resolvedCount} of {eligibleCount} live evidence requests resolved</p>
            <h2 id="next-view-heading">What WOLF needs to see next</h2>
          </div>
          {missingRequiredFacts.length > 0 ? (
            <span className="status-pill">{missingRequiredFacts.length} required facts unknown</span>
          ) : null}
        </div>

        {guidance.nextRequest ? (
          <div className="ops-next-request">
            <div className="row">
              <span className="field-chip">{guidance.nextRequest.priority}</span>
              <span className="field-chip">{guidance.nextRequest.safety.replaceAll('_', ' ')}</span>
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
              <button type="button" className="btn btn--secondary" onClick={() => void handleSkip()}>
                Defer with reason
              </button>
            </div>
          </div>
        ) : guidance.blockers.some((blocker) => blocker.blocksCapture) ? (
          <p>Ordinary capture is paused until the safety branch is resolved.</p>
        ) : guidance.readyForReview ? (
          <div className="stack">
            <p>All currently live requests are captured or explicitly deferred. The case can move to review without pretending deferred evidence was observed.</p>
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
            <p className="muted">Each artifact remains tied to the request it was meant to resolve.</p>
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
              const request = configuration.playbook.captureRequests.find((candidate) => candidate.requestId === artifact.requestId);
              return (
                <li className="card stack" key={artifact.artifactId}>
                  <EvidencePreview artifact={artifact} label={request?.label ?? artifact.requestId} />
                  <div>
                    <h3>{request?.label ?? artifact.requestId}</h3>
                    <p className="meta">{artifact.fileName ?? artifact.kind} · {artifact.sourceClass.replaceAll('_', ' ')}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="options-heading">
        <div>
          <p className="meta">DECISION RANGE · ILLUSTRATIVE UNTIL LOCAL EVIDENCE REPLACES THE PRIORS</p>
          <h2 id="options-heading">{configuration.decisionCase.title}</h2>
          <p>{configuration.decisionCase.context}</p>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-option-table">
            <thead>
              <tr>
                <th scope="col">Path</th>
                {configuration.decisionCase.metrics.map((metric) => (
                  <th scope="col" key={metric.metricId}>{metric.label}</th>
                ))}
                <th scope="col">Evidence-adjusted score</th>
              </tr>
            </thead>
            <tbody>
              {decisionEvaluation.options.map((option) => (
                <tr key={option.optionId} className={option.onParetoFrontier ? 'ops-frontier' : undefined}>
                  <th scope="row">
                    {option.label}
                    {option.onParetoFrontier ? <span className="status-pill status-pill--positive">non-dominated</span> : null}
                  </th>
                  {configuration.decisionCase.metrics.map((metric) => (
                    <td key={metric.metricId}>{option.metricValues[metric.metricId] ?? 'unknown'}</td>
                  ))}
                  <td>{option.weightedScore === null ? 'unknown' : `${Math.round(option.weightedScore * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ops-option-cards">
          {decisionEvaluation.options.map((option) => (
            <details className="card" key={option.optionId}>
              <summary>
                <strong>{option.label}</strong>{option.onParetoFrontier ? ' · non-dominated under current values' : ''}
              </summary>
              <p>{option.summary}</p>
              <div className="ops-tradeoff-grid">
                <div>
                  <h3>Benefits</h3>
                  <ul>{option.benefits.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Burdens</h3>
                  <ul>{option.burdens.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Assumptions</h3>
                  <ul>{option.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Reopen this path when</h3>
                  <ul>{option.reopeningTriggers.map((item) => <li key={item}>{item}</li>)}</ul>
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
  if (artifact.kind === 'photo') return <img className="ops-preview" src={url} alt={label} />;
  if (artifact.kind === 'video') return <video className="ops-preview" src={url} controls preload="metadata" aria-label={label} />;
  return null;
}
