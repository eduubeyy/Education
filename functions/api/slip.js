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

    // Search path 1: users node (where exam.js stores data with code field)
    const usersUrl = cleanedRtdb + "/users.json?auth=" + secret;
    const usersResp = await fetch(usersUrl);
    if (usersResp.ok) {
      const usersData = await usersResp.json();
      if (usersData && typeof usersData === "object") {
        for (const userId in usersData) {
          const currentRecord = usersData[userId];
          if (currentRecord) {
            const codeToCheck = currentRecord.code || currentRecord.success_code || "";
            if (String(codeToCheck) === String(inputCode)) {
              matchedData = { ...currentRecord, secureId: currentRecord.secureId || userId };
              targetExamBody = "neco";
              break;
            }
          }
        }
      }
    }

    // Search path 2: Exam_Data/NECO_DATA and Exam_Data/WAEC_DATA
    if (!matchedData) {
      const branches = ["NECO_DATA", "WAEC_DATA"];
      for (const branch of branches) {
        const fetchUrl = cleanedRtdb + "/Exam_Data/" + branch + ".json?auth=" + secret;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const fullBranchNode = await response.json();
          if (fullBranchNode && typeof fullBranchNode === "object") {
            for (const secureId in fullBranchNode) {
              const currentRecord = fullBranchNode[secureId];
              if (currentRecord) {
                const codeToCheck = currentRecord.success_code || currentRecord.code || "";
                if (String(codeToCheck) === String(inputCode)) {
                  matchedData = { ...currentRecord, secureId: secureId };
                  targetExamBody = branch === "NECO_DATA" ? "neco" : "waec";
                  break;
                }
              }
            }
          }
        }
        if (matchedData) break;
      }
    }

    if (!matchedData) {
      return new Response(JSON.stringify({ success: false, message: "Verification entry not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    matchedData.examBody = targetExamBody || matchedData.examBody || "neco";

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
