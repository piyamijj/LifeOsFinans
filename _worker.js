export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // 1. OANDA'DAN CANLI VERİ OPERASYONU
      const OANDA_URL = "https://api-fxpractice.oanda.com/v3";
      const pairs = ["XAU_USD", "EUR_USD", "USD_TRY"];
      let marketSnapshot = "";

      for (const p of pairs) {
        const res = await fetch(`${OANDA_URL}/instruments/${p}/candles?count=1&granularity=M15&price=M`, {
          headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
        });
        const d = await res.json();
        if (d.candles) marketSnapshot += `${p}: ${d.candles[0].mid.c} | `;
      }

      // 2. GEMINI DERİN ANALİZ (Araştırmacı Yapı)
      const prompt = `Sen Piyami'sin. Canlı veriler: ${marketSnapshot}. Teknik analiz yap ve strateji belirle. 
      Lütfen SADECE JSON dön. Şema: { 
        "globalStatus": "kısa özet", 
        "radarElements": ["madde1", "madde2"], 
        "strategies": { "scalp": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."}, "day": {...}, "swing": {...} } 
      }`;

      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const gData = await gRes.json();
      let cleanJson = gData.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanJson);

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
      // SİSTEM ÇÖKMESİN DİYE GÜVENLİ ÇIKIŞ
      return new Response(JSON.stringify({
        globalStatus: "OANDA/Gemini Hattında Gecikme",
        radarElements: ["Hata: " + e.message, "Yeniden deneniyor..."],
        strategies: {
          scalp: { pair: "XAU/USD", action: "YÜKLENİYOR", price: "0", tp: "0", sl: "0" },
          day: { pair: "EUR/USD", action: "YÜKLENİYOR", price: "0", tp: "0", sl: "0" },
          swing: { pair: "USD/TRY", action: "YÜKLENİYOR", price: "0", tp: "0", sl: "0" }
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
};
