// Putting a text on the clipboard of the member (L2E, commit 18: the ownership code he pastes into
// his bio). The Clipboard API needs a secure context and a gesture; when it refuses, the caller says
// so and the text stays selectable on screen. Nothing is read back and nothing is stored (D37).
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
