/** Wraps Clipboard API write for easier testing under jsdom. */
export async function copyTextToClipboard(text) {
  return navigator.clipboard.writeText(text);
}
