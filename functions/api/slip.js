export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");

  const allowedOrigins = [
    "https://educationv2.pages.dev",
    "http://localhost:8080"
  ];

  let corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const inputCode = body.code ? String(body.code).trim() : null;

    if (!inputCode || inputCode.length !== 6) {
      return new Response(JSON.stringify({ success: false, message: "Invalid code format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const rtdb = env.FIREBASE_RTDB_URL;
    const secret = env.FIREBASE_SECRET;

    if (!rtdb || !secret) {
      return new Response(JSON.stringify({ success: false, message: "Server database configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const cleanedRtdb = rtdb.endsWith("/") ? rtdb.slice(0, -1) : rtdb;
    let matchedData = null;
    let targetExamBody = null;

    // === GYARA: Search a cikin Exam_Data (Neco da Waec) ===
    // Wannan shine inda exam.js ke ajiye data daidai
    const fetchUrl = cleanedRtdb + "/Exam_Data.json?auth=" + secret;
    const fetchResp = await fetch(fetchUrl);
    if (fetchResp.ok) {
      const dbData = await fetchResp.json();
      if (dbData) {
        // Search a cikin Neco
        if (dbData.Neco) {
          for (const sid in dbData.Neco) {
            if (sid === "count") continue;
            const record = dbData.Neco[sid];
            const codeToCheck = record.success_code || "";
            if (String(codeToCheck) === String(inputCode)) {
              matchedData = { ...record, secureId: sid };
              targetExamBody = "neco";
              break;
            }
          }
        }
        // Search a cikin Waec idan ba'a samu ba
        if (!matchedData && dbData.Waec) {
          for (const sid in dbData.Waec) {
            if (sid === "count") continue;
            const record = dbData.Waec[sid];
            const codeToCheck = record.success_code || "";
            if (String(codeToCheck) === String(inputCode)) {
              matchedData = { ...record, secureId: sid };
              targetExamBody = "waec";
              break;
            }
          }
        }
      }
    }

    if (!matchedData) {
      return new Response(JSON.stringify({ success: false, message: "Verification entry not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    matchedData.examBody = targetExamBody || "neco";

    return new Response(JSON.stringify({ success: true, data: matchedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: "Internal error: " + err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
