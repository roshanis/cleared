export function maxDocumentChars(): number {
  const raw = process.env.MAX_DOCUMENT_CHARS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 50_000;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 50_000;
}
