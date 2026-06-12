import { useEffect, useState } from 'react';
import { loadRecord, type WolfDb } from '../../storage/index.js';
import { searchRecords, type SearchResult, type WolfRecord } from '../../engine/index.js';
import '../styles/data.css';

export type SearchScreenProps = {
  db: WolfDb;
  recordId: string;
  onNavigate: (hash: string) => void;
};

/**
 * Search view (DESIGN.md 10.1, 7.3): deterministic local lexical search over
 * the loaded record's title, subject, pack snapshot (section/lens/prompt
 * text and tags), and current response text.
 */
export function SearchScreen({ db, recordId, onNavigate }: SearchScreenProps): JSX.Element {
  const [record, setRecord] = useState<WolfRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadRecord(db, recordId);
        if (cancelled) return;
        setRecord(loaded);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, recordId]);

  // Debounced search on typing (~300ms), and immediate on submit.
  useEffect(() => {
    if (!record) return;
    const handle = window.setTimeout(() => {
      setResults(searchRecords(query, [record]));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, record]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!record) return;
    setResults(searchRecords(query, [record]));
  }

  function sectionLabel(sectionId: string): string {
    if (!sectionId) return '—';
    if (!record) return sectionId;
    const section = record.packSnapshot.sections.find((s) => s.id === sectionId);
    return section ? section.label : '—';
  }

  function promptText(promptId: string): string | null {
    if (!promptId || !record) return null;
    const prompt = record.packSnapshot.prompts.find((p) => p.id === promptId);
    return prompt ? prompt.text : null;
  }

  if (loading) {
    return <p>Loading…</p>;
  }

  if (error || !record) {
    return (
      <p role="alert" className="notice">
        Could not load record: {error ?? 'not found'}
      </p>
    );
  }

  return (
    <div className="stack">
      <h1>Search</h1>
      <p className="muted">{record.title}</p>

      <form className="search-form" onSubmit={handleSubmit}>
        <label htmlFor="search-query">Search this record</label>
        <input
          id="search-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a word or phrase…"
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>

      {query.trim().length === 0 ? (
        <p className="muted">
          Enter a word or phrase to search this record&rsquo;s title, subject, sections, prompts, tags, and
          current responses.
        </p>
      ) : results.length === 0 ? (
        <p className="muted">No matches found for &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="search-results">
          {results.map((result, index) => {
            const prompt = promptText(result.promptId);
            return (
              <li key={`${result.promptId}-${result.field}-${index}`} className="card">
                <span className="field-chip">{result.field}</span>
                <h3>Section: {sectionLabel(result.sectionId)}</h3>
                {prompt ? <p className="muted">{prompt}</p> : null}
                <p className="snippet">{result.snippet}</p>
                {result.promptId ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => onNavigate(`#/record/${encodeURIComponent(recordId)}/prompt/${encodeURIComponent(result.promptId)}`)}
                  >
                    Open prompt
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
