export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Tarayıcı güvenliği için OPTIONS isteği gereklidir
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // 1. OANDA VERİ ÇEKME (Hata Toleranslı)
      const OANDA_URL = "https://api-fxpractice.oanda.com";
      const pairs = ["XAU_USD", "EUR_USD", "USD_TRY"];
      let marketSnapshot = "";

      for (const p of pairs) {
        try {
          const res = await fetch(`${OANDA_URL}/instruments/${p}/candles?count=1&granularity=M15&price=M`, {
            headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
          });
          const d = await res.json();
          // NOT: Dizi boşsa çökmesini engellemek için d.candles[0] yerine d.candles?.[0] kullanıldı
          if (d.candles && d.candles.length > 0) {
            marketSnapshot += `${p}: ${d.candles[0].mid.c} | `;
          }
        } catch (err) {
          marketSnapshot += `${p}: Veri Alınamadı | `;
        }
      }

      // 2. GEMINI PROMPT (Formatı Kesinleştirildi)
      // Gemini'ye "Markdown kullanma" denildi, çünkü ```json ... ``` etiketleri JSON.parse'ı bozar.
      const prompt = `Sen Piyami'sin. Canlı piyasa verileri: ${marketSnapshot}. 
      Bu verileri teknik analiz süzgecinden geçir. 
      CEVABIN SADECE JSON FORMATINDA OLSUN. ASLA AÇIKLAMA YAZMA. 
      Şema: {
        "globalStatus": "Piyasanın genel havası",
        "radarElements": ["Madde 1", "Madde 2"],
        "strategies": {
          "scalp": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."},
          "day": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."},
          "swing": {"pair": "...", "action": "...", "price": "...", "tp": "...", "sl": "..."}
        }
      }`;

      const gRes = await fetch(`https://generativelanguage.googleapis.com{env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const gData = await gRes.json();
      
      // NOT: Gemini yanıtı bazen gData.candidates[0].content.parts[0].text içinde gönderir
      let rawText = gData.candidates[0].content.parts[0].text;
      
      // JSON Temizleme Operasyonu (En kritik kısım!)
      let cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      return new Response(cleanJson, { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });

    } catch (e) {
      // Hata durumunda boş dönmek yerine anlamlı bir JSON döndürülür
      return new Response(JSON.stringify({ 
        globalStatus: "Sistem Hatası", 
        radarElements: [e.message],
        strategies: { scalp: {pair: "Hata"}, day: {pair: "Hata"}, swing: {pair: "Hata"} }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
};
