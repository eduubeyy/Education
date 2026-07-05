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
    const inputCode = body.code ? body.code.trim() : null;

    if (!inputCode || inputCode.length !== 6) {
      return new Response(JSON.stringify({ success: false, message: "Invalid code format supplied" }), {
        status: 400,
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
    const branches = ["NECO_DATA", "WAEC_DATA"];
    let matchedData = null;
    let targetExamBody = null;

    for (const branch of branches) {
      const fetchUrl = `${cleanedRtdb}/Exam_Data/${branch}.json?auth=${secret}`;
      const response = await fetch(fetchUrl);
      
      if (response.ok) {
        const fullBranchNode = await response.json();
        if (fullBranchNode) {
          for (const secureId in fullBranchNode) {
            const currentRecord = fullBranchNode[secureId];
            if (currentRecord && String(currentRecord.success_code) === String(inputCode)) {
              matchedData = { ...currentRecord, secureId: secureId };
              targetExamBody = branch === "NECO_DATA" ? "neco" : "waec";
              break;
            }
          }
        }
      }
      if (matchedData) break;
    }

    if (!matchedData) {
      return new Response(JSON.stringify({ success: false, message: "Verification entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    matchedData.examBody = targetExamBody;

    return new Response(JSON.stringify({ success: true, data: matchedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: "Internal application processor error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
