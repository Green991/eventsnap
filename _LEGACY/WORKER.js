// Cloudflare Worker — EventSnap CORS Proxy
// 1) Pega este código en Workers & Pages > Create Worker
// 2) Publica y copia la URL ...workers.dev
// 3) En Netlify, en index.html, reemplaza API_URL por tu URL del worker.

export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyYExmMz9ioyze6YWbJ-HThZ_QztsLpTF3VVD0INHIlKQs4k4A7nnZeD0FwYBZmtD_d/exec";
    const body = await request.text();

    const resp = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    const text = await resp.text();

    return new Response(text, {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
