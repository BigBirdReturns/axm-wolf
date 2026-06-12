// Minimal placeholder screens (DESIGN.md 10.1) so navigation is provable in
// wave 1. Each renders the relevant route parameters and a "coming in wave
// 2" notice. Wave 2 replaces these with full implementations.

function Placeholder({
  heading,
  params,
}: {
  heading: string;
  params: Record<string, string>;
}): JSX.Element {
  return (
    <div className="stack">
      <h1>{heading}</h1>
      <dl className="meta">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="row">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="notice">This screen is coming in wave 2.</p>
      <p>
        <a className="btn btn--secondary" href="#/records">
          Back to records
        </a>
      </p>
    </div>
  );
}

export function RecordsScreen(): JSX.Element {
  return <Placeholder heading="Records" params={{}} />;
}

export function RecordHomeScreen({ recordId }: { recordId: string }): JSX.Element {
  return <Placeholder heading="Record home" params={{ recordId }} />;
}

export function RecordSectionScreen({
  recordId,
  sectionId,
}: {
  recordId: string;
  sectionId: string;
}): JSX.Element {
  return <Placeholder heading="Section" params={{ recordId, sectionId }} />;
}

export function RecordPromptScreen({
  recordId,
  promptId,
}: {
  recordId: string;
  promptId: string;
}): JSX.Element {
  return <Placeholder heading="Prompt" params={{ recordId, promptId }} />;
}

export function RecordSearchScreen({ recordId }: { recordId: string }): JSX.Element {
  return <Placeholder heading="Search" params={{ recordId }} />;
}

export function RecordExportScreen({ recordId }: { recordId: string }): JSX.Element {
  return <Placeholder heading="Export and data" params={{ recordId }} />;
}

export function PacksScreen(): JSX.Element {
  return <Placeholder heading="Packs" params={{}} />;
}

export function SettingsScreen(): JSX.Element {
  return <Placeholder heading="Settings" params={{}} />;
}

export function NotFoundScreen({ path }: { path: string }): JSX.Element {
  return <Placeholder heading="Not found" params={{ path }} />;
}
