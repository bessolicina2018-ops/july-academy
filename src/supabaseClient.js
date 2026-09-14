import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jgoselyqteyoodefuazc.supabase.co";
const supabaseAnonKey = "sb_publishable_Nc_x7M9dQrouPbW8zCkw2A_hBq3S4kD";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
