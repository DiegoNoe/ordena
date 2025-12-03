export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { to, message } = await request.json();
      if (!to || !message) {
        return new Response(JSON.stringify({ error: "Missing 'to' or 'message'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Format destination as WhatsApp E.164 (Mexico)
      const toMX = `whatsapp:+52${String(to).replace(/\D/g, "")}`;

      // Twilio REST API
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`;
      const body = new URLSearchParams({
        From: env.TWILIO_FROM, // e.g. whatsapp:+14155238886 (sandbox) or your business number
        To: toMX,
        Body: message,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }
  },
};