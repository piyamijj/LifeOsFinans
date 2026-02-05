export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const result = await this.executeAnalysis(env, "Manuel Tetikleme");
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      // SİSTEM ÇÖKMESİN DİYE GEÇİCİ DÖNÜŞ (Gerçek veri gelene kadar ekranı açık tutar)
      return new Response(JSON.stringify({
        global_status: "OANDA Bağlantısı Kuruluyor...",
        radar_elements: ["Veri Hattı Kontrol Ediliyor..."],
        strategies: {
          scalp: { pair: "Yükleniyor", action: "WAIT", price: "0", tp: "0", sl: "0" },
          day: { pair: "Yükleniyor", action: "WAIT", price: "0", tp: "0", sl: "0" },
          swing: { pair: "Yükleniyor", action: "WAIT", price: "0", tp: "0", sl: "0" }
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(this.executeAnalysis(env, "Otonom Tarama"));
  },

  async executeAnalysis(env, reason) {
    const OANDA_URL = env.OANDA_ENV === 'practice' 
      ? "https://api-fxpractice.oanda.com/v3" 
      : "https://api-fxtrade.oanda.com/v3";
    
    const targets = ["EUR_USD", "XAU_USD", "USD_JPY", "USD_TRY"];
    let marketData = "";

    // GERÇEK OANDA VERİSİ ÇEKİLİYOR
    for (const t of targets) {
      try {
        const res = await fetch(`${OANDA_URL}/instruments/${t}/candles?count=1&granularity=H1&price=M`, {
          headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
        });
        const d = await res.json();
        if (d.candles && d.candles.length > 0) {
          marketData += `${t}: ${d.candles[0].mid.c} | `;
        }
      } catch (e) {
        console.log(`${t} çekilemedi, bir sonraki denenecek.`);
      }
    }

    // GEMINI ANALİZİ (Gerçek Veri Üzerinden)
    const prompt = `Sen Piyami'sin. Veriler: ${marketData}. Bu verilere göre teknik analiz yap. 
    Lütfen sadece JSON formatında cevap ver. 
    Şema: { "global_status": string, "radar_elements": string[], "strategies": { "scalp": object, "day": object, "swing": object }, "telegram_alert": string }`;

    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const gData = await gRes.json();
    let raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(raw);

    // TELEGRAMA GERÇEK RAPOR GÖNDERİMİ
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: env.TELEGRAM_CHAT.startsWith('@') ? env.TELEGRAM_CHAT : `@${env.TELEGRAM_CHAT}`, 
          text: result.telegram_alert, 
          parse_mode: "Markdown" 
        })
      });
    }

    return result;
  }
};
