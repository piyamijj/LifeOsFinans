export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Arayüzü Göster (GET İsteği)
    if (request.method === "GET") {
      return env.ASSETS.fetch(request);
    }

    // 2. Veriyi İşle (POST İsteği)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    try {
      // OANDA'dan fiyat çekme
      const oandaRes = await fetch("https://api-fxpractice.oanda.com/v3/instruments/XAU_USD/candles?count=1&granularity=M15&price=M", {
        headers: { "Authorization": `Bearer ${env.OANDA_API_KEY}` }
      });
      const oandaData = await oandaRes.json();
      const price = oandaData.candles ? oandaData.candles[0].mid.c : "Bilinmiyor";

      // Gemini Analizi
      const prompt = `Fiyat: ${price}. Analiz yap ve şu JSON şemasında dön: {"globalStatus": "...", "radarElements": ["..."], "strategies": {"scalp": {"pair": "XAU/USD", "action": "...", "price": "${price}", "tp": "...", "sl": "..."}}}`;
      
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const gData = await gRes.json();
      const rawText = gData.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      return new Response(rawText, { headers: corsHeaders });

    } catch (e) {
      // Hata olsa bile BOŞ DÖNME, JSON dön!
      return new Response(JSON.stringify({
        globalStatus: "Bağlantı Hatası",
        radarElements: ["Hata: " + e.message],
        strategies: { scalp: {pair:"-", action:"-", price:"0", tp:"0", sl:"0"} }
      }), { headers: corsHeaders });
    }
  }
};
