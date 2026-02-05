export default {
  // 1. Siteden bir talep gelirse (Butona basınca)
  async fetch(request, env) {
    // CORS ayarları (Frontend'den erişim için)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const result = await this.executeAnalysis(env, "Kullanıcı manuel tetikleme yaptı.");
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  },

  // 2. OTONOM ÇALIŞMA (Cron Job - 15 dakikada bir)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(this.executeAnalysis(env, "Otonom Nöbetçi Taraması."));
  },

  // ANA ANALİZ MOTORU
  async executeAnalysis(env, contextReason) {
    const OANDA_URL = "https://api-fxpractice.oanda.com/v3";
    
    // 1. Piyasa Verilerini Topla
    const targets = ["EUR_USD", "XAU_USD", "USD_JPY", "GBP_USD"];
    let marketReport = "";
    for (const t of targets) {
      const res = await fetch(`${OANDA_URL}/instruments/${t}/candles?count=1&granularity=H1&price=M`, {
        headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
      });
      const d = await res.json();
      if (d.candles) marketReport += `${t}: ${d.candles[0].mid.c} | `;
    }

    // 2. Gemini'den Emir Al
    const prompt = `Sen Piyami LifeOS'sun. Durum: ${contextReason}. Veriler: ${marketReport}. Riskli bir fırsat varsa Telegram mesajı hazırla, yoksa 'Sakin' de. JSON formatında ver.`;
    
    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const gData = await gRes.json();
    let raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(raw);

    // 3. Telegram'a Ateşle
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: env.TELEGRAM_CHAT, 
          text: result.telegram_alert || "📡 Piyami Nöbette: Ciddi bir hareket yok.",
          parse_mode: "Markdown" 
        })
      });
    }
    return result;
  }
};
