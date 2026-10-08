import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey && process.env.NEXT_PUBLIC_MESS_ID);
export const supabase = cloudEnabled ? createClient(url!, anonKey!) : null;
export const messId = process.env.NEXT_PUBLIC_MESS_ID || "";
