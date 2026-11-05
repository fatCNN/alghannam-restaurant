import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} from "./supabase-config.js";

export const isSupabaseConfigured =
    /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(SUPABASE_URL || "") &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_ANON_KEY.length > 25 &&
    !/YOUR_|ضع_المفتاح/i.test(SUPABASE_ANON_KEY);

export const supabaseClient = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;