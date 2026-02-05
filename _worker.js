export default {
  // 1. MANUEL TETİKLEME (SİTEDEN GELEN İSTEK)
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const result = await this.executeAnalysis(env, "Kullanıcı Manuel Sorgusu");
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      // Hata durumunda frontend'in çökmemesi için boş ama geçerli bir JSON döndürür
      return new Response(JSON.stringify({
        global_status: "Analiz Bekleniyor...",
        radar_elements: ["Sistem Başlatılıyor"],
        strategies: {
          scalp: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" },
          day: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" },
          swing: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" }
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },

  // 2. OTONOM ÇALIŞMA (CRON JOB)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(this.executeAnalysis(env, "Periyodik Otonom Tarama"));
  },

  // 3. ANA ANALİZ VE TELEGRAM MOTORU
  async executeAnalysis(env, reason) {
    const OANDA_URL = "https://api-fxpractice.oanda.com/v3";
    const targets = ["EUR_USD", "XAU_USD", "USD_JPY", "GBP_USD"];
    let marketData = "";

    // OANDA'dan fiyatları çekiyoruz
    for (const t of targets) {
      try {
        const res = await fetch(`${OANDA_URL}/instruments/${t}/candles?count=1&granularity=H1&price=M`, {
          headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
        });
        const d = await res.json();
        if (d.candles && d.candles.length > 0) {
          marketData += `${t}: ${d.candles[0].mid.c} | `;
        }
      } catch (e) { console.log(t + " verisi çekilemedi."); }
    }

    // Gemini ile analiz yapıyoruz
    const prompt = `Sen Piyami'sin. Neden: ${reason}. Piyasa: ${marketData}. 
    Analiz yap ve sadece şu JSON formatında cevap ver:
    {
      "global_status": "Piyasa özeti",
      "radar_elements": ["Unsur 1", "Unsur 2"],
      "strategies": {
        "scalp": {"pair": "EUR_USD", "action": "BUY", "price": "1.08", "tp": "1.09", "sl": "1.07"},
        "day": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."},
        "swing": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."}
      },
      "telegram_alert": "🚨 *PİYAMİ OPERASYON EMRİ* 🚨\\n\\nAnaliz: [Teknik neden]\\n📍 Çift: XAU/USD\\n📈 İşlem: BUY"
    }`;

    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const gData = await gRes.json();
    let raw = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(raw);

    // Telegram'a gönderim (Kullanıcı adının başına @ eklediğinden emin ol)
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT) {
      const chatId = env.TELEGRAM_CHAT.startsWith('@') ? env.TELEGRAM_CHAT : `@${env.TELEGRAM_CHAT}`;
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: result.telegram_alert, 
          parse_mode: "Markdown" 
        })
      });
    }

    return result;
  }
};
