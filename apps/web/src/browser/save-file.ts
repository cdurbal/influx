// Saving a file the screen received (J8 commit 8: the export of "mes données"). The relay forwards
// no Content-Disposition (03 PP-10), so the browser makes the download itself: the characters given
// are saved as they are (UTF-8), under the name given; the object URL is released right after the
// click has been handled (released synchronously, some browsers would cancel the download).
export function saveTextFile(
  fileName: string,
  content: string,
  type = "application/json",
): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${type};charset=utf-8` }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
