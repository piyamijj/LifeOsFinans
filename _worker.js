export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const result = await this.executeAnalysis(env, "Manuel Sorgu");
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ 
        global_status: "Analiz Bekleniyor...",
        radar_elements: [], // Çökmeyi önleyen boş liste
        strategies: { scalp: {}, day: {}, swing: {} }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(this.executeAnalysis(env, "Otonom Tarama"));
  },

  async executeAnalysis(env, reason) {
    // Market verisi ve Gemini çağrısı buraya gelecek (Önceki kodun aynısı)
    // ÖNEMLİ: env.OANDA_API_KEY gibi değişkenlerin Cloudflare panelinde 
    // "Settings -> Variables" kısmına eklendiğinden emin olmalısın.
    
    // Varsayılan boş yapı (Hata anında arayüzü korur)
    return {
      global_status: "Piyasalar taranıyor...",
      radar_elements: ["Bağlantı Kontrol Ediliyor"],
      strategies: {
        scalp: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" },
        day: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" },
        swing: { pair: "-", action: "-", price: "-", tp: "-", sl: "-" }
      }
    };
  }
};
