import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url || "", key || "");
export const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "wedding-photos";

export function publicImageUrl(path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
