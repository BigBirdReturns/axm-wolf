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

export async function shareOrDownloadText(
  filename: string,
  mimeType: string,
  text: string,
  title: string,
  message: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], filename, { type: mimeType });
  const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof navigator.share === 'function' && shareNavigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text: message, files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  downloadText(filename, mimeType, text);
  return 'downloaded';
}
