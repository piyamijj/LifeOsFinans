export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    let debugLog = [];

    try {
      debugLog.push("1. OANDA Operasyonu Başlıyor...");
      const OANDA_URL = "https://api-fxpractice.oanda.com/v3";
      
      // OANDA Anahtar Kontrolü
      if (!env.OANDA_API_KEY) throw new Error("OANDA_API_KEY Cloudflare panelinde tanımlanmamış!");

      const resPrice = await fetch(`${OANDA_URL}/instruments/XAU_USD/candles?count=1&granularity=M15&price=M`, {
        headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
      });

      if (!resPrice.ok) {
        const errorDetail = await resPrice.text();
        throw new Error(`OANDA Hatası (${resPrice.status}): ${errorDetail}`);
      }

      const priceData = await resPrice.json();
      const currentPrice = priceData.candles[0].mid.c;
      debugLog.push(`2. Fiyat Alındı: ${currentPrice}`);

      debugLog.push("3. Gemini Analizi Başlıyor...");
      if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY Cloudflare panelinde tanımlanmamış!");

      // Gemini'ye Gönderilen Paket
      const prompt = `Altın fiyatı: ${currentPrice}. Kısa teknik analiz yap ve JSON formatında dön. Şema: {"globalStatus": "...", "radarElements": ["..."], "strategies": {"scalp": {"pair": "XAU/USD", "action": "...", "price": "${currentPrice}", "tp": "...", "sl": "..."}}}`;

      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!gRes.ok) throw new Error(`Gemini Hatası: ${gRes.status}`);

      const gData = await gRes.json();
      let cleanJson = gData.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanJson);

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
      // Hata raporunu arayüze gönderiyoruz
      return new Response(JSON.stringify({
        globalStatus: "SİSTEM DURDURULDU",
        radarElements: ["HATA RAPORU:", e.message, "İZLEME:", ...debugLog],
        strategies: {
          scalp: { pair: "HATA", action: "KONTROL ET", price: "0", tp: "0", sl: "0" },
          day: { pair: "HATA", action: "KONTROL ET", price: "0", tp: "0", sl: "0" },
          swing: { pair: "HATA", action: "KONTROL ET", price: "0", tp: "0", sl: "0" }
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
};
