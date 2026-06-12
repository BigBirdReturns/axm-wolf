/**
 * Browser download helper (DESIGN.md 10.1 export). Creates a Blob, an
 * object URL, and a transient anchor click to trigger a file download, then
 * revokes the URL. No remote requests; no persistence beyond the download.
 */
export function downloadText(filename: string, mimeType: string, text: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
