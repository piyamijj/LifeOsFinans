export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    // 1. Sayfa Görüntüleme (GET)
    if (request.method === "GET") {
      return env.ASSETS.fetch(request);
    }

    // 2. Analiz Başlatma (POST)
    try {
      if (!env.OANDA_API_KEY || !env.GEMINI_API_KEY) {
        throw new Error("API Anahtarları Cloudflare panelinde eksik!");
      }

      // OANDA Testi
      const oandaRes = await fetch("https://api-fxpractice.oanda.com/v3/instruments/XAU_USD/candles?count=1&granularity=M15&price=M", {
        headers: { "Authorization": `Bearer ${env.OANDA_API_KEY}` }
      });
      
      if (!oandaRes.ok) throw new Error(`OANDA Bağlantı Sorunu: ${oandaRes.status}`);
      const oandaData = await oandaRes.json();
      const price = oandaData.candles[0].mid.c;

      // Gemini Analizi
      const prompt = `Altın fiyatı ${price}. Kısa bir analiz yap ve JSON dön: {"globalStatus": "AKTİF", "radarElements": ["Analiz Tamamlandı"], "strategies": {"scalp": {"pair": "XAU/USD", "action": "BEKLE", "price": "${price}", "tp": "0", "sl": "0"}}}`;
      
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const gData = await gRes.json();
      const text = gData.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();

      return new Response(text, { headers: corsHeaders });

    } catch (e) {
      // Hata olsa bile JSON olarak döndür ki tarayıcı çökmesin
      return new Response(JSON.stringify({
        globalStatus: "SİSTEM DURAKLADI",
        radarElements: ["Hata Mesajı: " + e.message],
        strategies: { scalp: { pair: "HATA", action: "KONTROL", price: "0", tp: "0", sl: "0" } }
      }), { headers: corsHeaders });
    }
  }
};
