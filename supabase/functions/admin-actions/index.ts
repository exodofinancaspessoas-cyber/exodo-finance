import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // ── Validate caller is admin ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");

    // Verify the JWT using the anon supabase client to decode it
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ error: "Unauthorized" }, 401);
    if (caller.email !== ADMIN_EMAIL) return json({ error: "Forbidden: not an admin" }, 403);

    // ── Admin service role client ────────────────────────────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { action, payload = {} } = body as { action: string; payload: Record<string, any> };

    // ============================================================
    //  list_users
    // ============================================================
    if (action === "list_users") {
        const { data, error } = await admin.from("admin_users_overview").select("*");
        if (error) return json({ error: error.message }, 500);
        return json({ users: data });
    }

    // ============================================================
    //  get_user_summary
    // ============================================================
    if (action === "get_user_summary") {
        const { user_id } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const [overviewRes, txRes, accRes, goalsRes] = await Promise.all([
            admin.from("admin_users_overview").select("*").eq("id", user_id).single(),
            admin.from("transactions")
                .select("id,description,amount,type,status,date,category_id")
                .eq("user_id", user_id)
                .neq("status", "EXCLUIDA")
                .order("date", { ascending: false })
                .limit(10),
            admin.from("accounts").select("id,name,balance,type").eq("user_id", user_id),
            admin.from("goals").select("id,name,target_amount,current_amount,status").eq("user_id", user_id).eq("status", "ACTIVE"),
        ]);

        return json({
            user: overviewRes.data,
            recent_transactions: txRes.data ?? [],
            accounts: accRes.data ?? [],
            active_goals: goalsRes.data ?? [],
        });
    }

    // ============================================================
    //  unblock_user
    // ============================================================
    if (action === "unblock_user") {
        const { user_id, days = 30 } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const trial_ends = new Date();
        trial_ends.setDate(trial_ends.getDate() + Number(days));

        const { error } = await admin.from("subscriptions").upsert({
            user_id,
            plan: "PRO",
            trial_ends: trial_ends.toISOString(),
            blocked_at: null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) return json({ error: error.message }, 500);
        return json({ success: true, message: `Acesso liberado por ${days} dias` });
    }

    // ============================================================
    //  block_user
    // ============================================================
    if (action === "block_user") {
        const { user_id } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const { error } = await admin.from("subscriptions").upsert({
            user_id,
            plan: "BLOCKED",
            blocked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) return json({ error: error.message }, 500);
        return json({ success: true, message: "Usuário bloqueado" });
    }

    // ============================================================
    //  extend_trial
    // ============================================================
    if (action === "extend_trial") {
        const { user_id, days = 7 } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        // Get current trial_ends to extend from
        const { data: sub } = await admin.from("subscriptions").select("trial_ends").eq("user_id", user_id).single();
        const base = sub?.trial_ends ? new Date(sub.trial_ends) : new Date();
        if (base < new Date()) base.setTime(new Date().getTime()); // if already expired, start from today
        base.setDate(base.getDate() + Number(days));

        const { error } = await admin.from("subscriptions").upsert({
            user_id,
            trial_ends: base.toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) return json({ error: error.message }, 500);
        return json({ success: true, message: `Trial estendido por ${days} dias` });
    }

    // ============================================================
    //  update_notes
    // ============================================================
    if (action === "update_notes") {
        const { user_id, notes } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const { error } = await admin.from("subscriptions").upsert({
            user_id,
            notes: notes ?? "",
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
    }

    // ============================================================
    //  delete_user  (IRREVERSIBLE)
    // ============================================================
    if (action === "delete_user") {
        const { user_id } = payload;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const tables = [
            "transactions", "accounts", "cards", "categories",
            "goals", "budgets", "recurring_expenses", "transfers",
            "subscriptions", "profiles",
        ];

        for (const table of tables) {
            try {
                await admin.from(table).delete().eq("user_id", user_id);
            } catch (_) { /* continue even if table doesn't exist */ }
        }

        // Remove from auth
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(user_id);
        if (authDeleteError) return json({ error: `Auth delete failed: ${authDeleteError.message}` }, 500);

        return json({ success: true, message: "Usuário e todos os dados removidos permanentemente" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
});
