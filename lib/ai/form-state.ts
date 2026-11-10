/** Status form pembuatan token AI (dipakai server action + komponen klien). */
export type AiTokenFormState = { ok: boolean; message: string | null; token?: string };

export const initialAiTokenFormState: AiTokenFormState = { ok: true, message: null };
