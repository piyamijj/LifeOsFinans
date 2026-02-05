export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // OANDA Veri Çekme Bölümü
      const OANDA_URL = "https://api-fxpractice.oanda.com/v3";
      const resPrice = await fetch(`${OANDA_URL}/instruments/XAU_USD/candles?count=1&granularity=M15&price=M`, {
        headers: { 'Authorization': `Bearer ${env.OANDA_API_KEY}` }
      });
      const priceData = await resPrice.json();
      const currentPrice = priceData.candles ? priceData.candles[0].mid.c : "Bilinmiyor";

      // Arayüze ve Gemini'ye gidecek yapı
      const result = {
        globalStatus: `Altın şu an ${currentPrice} seviyesinde. Radar aktif.`,
        radarElements: ["Piyasa Volatilitesi: Normal", "Trend: Stabil", "Hacim: Orta"],
        strategies: {
          scalp: { pair: "XAU/USD", action: "BUY", price: currentPrice, tp: "2060", sl: "2040" },
          day: { pair: "EUR/USD", action: "WAIT", price: "1.08", tp: "1.09", sl: "1.07" },
          swing: { pair: "USD/TRY", action: "BEKLE", price: "43.54", tp: "45.00", sl: "42.50" }
        }
      };

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
