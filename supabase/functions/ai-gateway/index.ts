import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GatewayRequest {
    action: "categorize" | "scan_receipt" | "chat";
    payload: Record<string, unknown>;
}

// Simple in-memory rate limiter per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

// ─── Claude API Helper ────────────────────────────────────────────────────────
async function callClaude(params: {
    model: string;
    system?: string;
    messages: { role: string; content: string | object[] }[];
    maxTokens?: number;
}): Promise<string> {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: params.model,
            max_tokens: params.maxTokens ?? 256,
            system: params.system,
            messages: params.messages,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Claude API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? "";
}

// ─── Handler: Categorize ──────────────────────────────────────────────────────
async function handleCategorize(payload: Record<string, unknown>) {
    const { description, categories } = payload as {
        description: string;
        categories: { id: string; name: string; type: string }[];
    };

    if (!description || !categories?.length) {
        return { category_id: null, confidence: 0 };
    }

    const categoryList = categories
        .map((c) => `${c.id} | ${c.name} (${c.type})`)
        .join("\n");

    const systemPrompt = `Você é um classificador de despesas e receitas financeiras. 
Dada uma descrição de transação, retorne o ID da categoria mais adequada.
Responda APENAS com JSON no formato: {"category_id": "uuid-aqui", "confidence": 0.95}
Não inclua nenhum outro texto.`;

    const userMessage = `Transação: "${description}"

Categorias disponíveis (ID | Nome | Tipo):
${categoryList}

Qual categoria melhor se encaixa? Responda em JSON.`;

    const raw = await callClaude({
        model: "claude-haiku-4-5-20251001",
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 100,
    });

    try {
        const jsonMatch = raw.match(/\{[^}]+\}/);
        if (!jsonMatch) throw new Error("No JSON in response");
        return JSON.parse(jsonMatch[0]);
    } catch {
        return { category_id: null, confidence: 0 };
    }
}

// ─── Handler: Scan Receipt ────────────────────────────────────────────────────
async function handleScanReceipt(payload: Record<string, unknown>) {
    const { image, mimeType } = payload as { image: string; mimeType: string };

    if (!image) return { error: "No image provided" };

    const systemPrompt = `Você é um sistema de OCR especializado em cupons fiscais brasileiros.
Extraia as informações do cupom e retorne APENAS JSON válido no formato:
{"description": "Nome do estabelecimento", "amount": 47.80, "date": "2026-02-25", "items": ["Item 1", "Item 2"]}
- description: nome do estabelecimento/loja
- amount: valor TOTAL da compra (número decimal)
- date: data da compra no formato YYYY-MM-DD
- items: lista dos principais itens (máximo 5)
Se não conseguir extrair algum campo, use null para esse campo.
Responda APENAS com o JSON, sem mais nenhum texto.`;

    const raw = await callClaude({
        model: "claude-sonnet-4-5",
        system: systemPrompt,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mimeType || "image/jpeg",
                            data: image,
                        },
                    },
                    {
                        type: "text",
                        text: "Extraia os dados deste cupom fiscal.",
                    },
                ],
            },
        ],
        maxTokens: 400,
    });

    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in response");
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            description: parsed.description || null,
            amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || null,
            date: parsed.date || null,
            items: Array.isArray(parsed.items) ? parsed.items.slice(0, 5) : [],
        };
    } catch {
        return { error: "Não foi possível extrair os dados. Tente com uma foto mais nítida." };
    }
}

// ─── Handler: Chat ────────────────────────────────────────────────────────────
async function handleChat(payload: Record<string, unknown>) {
    const { message, context, history = [] } = payload as {
        message: string;
        context: Record<string, unknown>;
        history: { role: string; content: string }[];
    };

    if (!message) return { reply: "Por favor, faça uma pergunta." };

    const today = new Date().toLocaleDateString("pt-BR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const systemPrompt = `Você é o Êxodo IA, assistente financeiro pessoal do Êxodo Finance.
Você é direto, empático, e NUNCA faz julgamentos sobre hábitos financeiros.
Responda sempre em português brasileiro. Seja conciso (máximo 3 parágrafos).

CONTEXTO FINANCEIRO DO USUÁRIO:
- Saldo total atual: R$ ${context.totalBalance ?? "não informado"}
- Receitas do mês: R$ ${context.monthIncome ?? 0}
- Despesas do mês: R$ ${context.monthExpense ?? 0}
- Top categorias: ${JSON.stringify(context.topCategories ?? [])}
- Status orçamentos: ${JSON.stringify(context.budgetStatus ?? [])}
- Metas ativas: ${JSON.stringify(context.goalProgress ?? [])}
- Data de hoje: ${today}

REGRAS:
- Use APENAS os dados do contexto acima para responder sobre finanças
- NÃO invente dados, valores ou categorias que não estão no contexto
- Se não tiver informação suficiente, diga honestamente que não tem os dados
- Para cálculos, mostre os valores em R$ com vírgula brasileira
- Seja encorajador mas realista`;

    const messages = [
        ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    const reply = await callClaude({
        model: "claude-sonnet-4-5",
        system: systemPrompt,
        messages,
        maxTokens: 500,
    });

    return { reply };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
    };

    try {
        // Auth validation
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        // Extract user ID from JWT (basic decode — Supabase validates via RLS)
        const token = authHeader.slice(7);
        let userId = "anonymous";
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            userId = payload.sub ?? "anonymous";
        } catch {
            // Keep anonymous if decode fails
        }

        // Rate limiting
        if (!checkRateLimit(userId)) {
            return new Response(
                JSON.stringify({ error: "Limite de chamadas por hora excedido. Tente novamente em 1 hora." }),
                { status: 429, headers: corsHeaders }
            );
        }

        // Parse body
        const body: GatewayRequest = await req.json();
        const { action, payload } = body;

        if (!action || !payload) {
            return new Response(JSON.stringify({ error: "Missing action or payload" }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Check API key exists before calling handlers
        const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "IA não configurada. Adicione a ANTHROPIC_API_KEY nas configurações." }),
                { status: 503, headers: corsHeaders }
            );
        }

        let result: unknown;
        switch (action) {
            case "categorize":
                result = await handleCategorize(payload);
                break;
            case "scan_receipt":
                result = await handleScanReceipt(payload);
                break;
            case "chat":
                result = await handleChat(payload);
                break;
            default:
                return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
                    status: 400,
                    headers: corsHeaders,
                });
        }

        return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });

    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        console.error("[ai-gateway] Error:", message);

        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
