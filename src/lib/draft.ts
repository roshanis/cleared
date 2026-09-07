import { z } from "zod";
import { SUPPORTED_JURISDICTIONS } from "./rubric";

const draftSchema = z.object({
  title: z.string(), content: z.string(),
  markets: z.array(z.enum(SUPPORTED_JURISDICTIONS)).min(1),
  requestKey: z.string(), runId: z.string().nullable(), documentId: z.string().nullable(), savedAt: z.number(),
});
export type SavedDraft = z.infer<typeof draftSchema>;
export const draftKey = (userId: string, documentId?: string) => `cleared:draft:v1:${encodeURIComponent(userId)}:${documentId ?? "new"}`;
export function readDraft(storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "removeItem">>, key: string, now = Date.now()): SavedDraft | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(storage.getItem(key) ?? "null"));
    if (parsed.success && now >= parsed.data.savedAt && now - parsed.data.savedAt < 8 * 3600_000) return parsed.data;
    storage.removeItem?.(key);
    return null;
  } catch { return null; }
}
export function saveDraft(storage: Pick<Storage, "setItem">, key: string, draft: SavedDraft): boolean {
  try { storage.setItem(key, JSON.stringify(draft)); return true; } catch { return false; }
}
