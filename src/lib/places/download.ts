/** Trigger a browser file download from a string body. */
export function downloadTextFile(params: {
  filename: string;
  mime: string;
  body: string;
}): void {
  const blob = new Blob([params.body], { type: params.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = params.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
