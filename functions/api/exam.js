export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "*";

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400"
                }
            });
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Content-Type": "application/json"
        };

        const rtdb = (env.FIREBASE_RTDB_URL || "").replace(/\/+$/, "");
        const secret = env.FIREBASE_SECRET || "";

        if (!rtdb || !secret) {
            return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
                status: 500,
                headers: corsHeaders
            });
        }

        if (request.method === "GET") {
            try {
                const lookupUrl = `${rtdb}/Exam_Data.json?auth=${secret}`;
                const fetchResp = await fetch(lookupUrl);
                if (!fetchResp.ok) {
                    return new Response(JSON.stringify({ success: false, error: "Database fetch failed" }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                const dbData = await fetchResp.json() || {};
                
                const total = dbData.Total_Exam ? (dbData.Total_Exam.count || 0) : 0;
                const flatUsers = [];
                
                ["Neco", "Waec"].forEach(body => {
                    if (dbData[body]) {
                        Object.keys(dbData[body]).forEach(sid => {
                            flatUsers.push({
                                name: dbData[body][sid].candidate_name || "",
                                secureId: sid,
                                code: dbData[body][sid].success_code || ""
                            });
                        });
                    }
                });

                return new Response(JSON.stringify({ success: true, totalCount: total, users: flatUsers }), {
                    status: 200,
                    headers: corsHeaders
                });
            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: corsHeaders
                });
            }
        }

        if (request.method === "POST") {
            try {
                const body = await request.json();

                if (!body.password || body.password !== "@haruna66") {
                    return new Response(JSON.stringify({ success: false, error: "Invalid access password" }), {
                        status: 401,
                        headers: corsHeaders
                    });
                }

                const targetBranch = body.examBody && body.examBody.toLowerCase() === "waec" ? "Waec" : "Neco";
                const secureId = body.secureId || "";

                if (!secureId || !body.candidate_name || !body.exam_number) {
                    return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }

                const codeSeed = Math.floor(100000 + Math.random() * 900000).toString();

                const recordData = {
                    candidate_name: body.candidate_name,
                    exam_number: body.exam_number,
                    exam_year: body.exam_year || "",
                    exam_type: body.exam_type || "",
                    school_number: body.school_number || "",
                    school_name: body.school_name || "",
                    gender: body.gender || "",
                    dob: body.dob || "",
                    subjects: body.subjects || {},
                    qr_link: body.qr_link || "",
                    success_code: codeSeed,
                    created_at: new Date().toISOString()
                };

                const nodeUrl = `${rtdb}/Exam_Data/${targetBranch}/${secureId}.json?auth=${secret}`;
                const saveRecord = await fetch(nodeUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(recordData)
                });

                if (!saveRecord.ok) {
                    const errText = await saveRecord.text();
                    return new Response(JSON.stringify({ success: false, error: "Save failed: " + errText }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }

                const counterUrl = `${rtdb}/Exam_Data/Total_Exam/count.json?auth=${secret}`;
                const counterResp = await fetch(counterUrl);
                let currentCount = 0;
                if (counterResp.ok) {
                    currentCount = await counterResp.json() || 0;
                }
                currentCount = Number(currentCount) + 1;

                await fetch(counterUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(currentCount)
                });

                return new Response(JSON.stringify({
                    success: true,
                    code: codeSeed,
                    totalCount: currentCount
                }), {
                    status: 200,
                    headers: corsHeaders
                });

            } catch (err) {
                return new Response(JSON.stringify({ success: false, error: "Server error: " + err.message }), {
                    status: 500,
                    headers: corsHeaders
                });
            }
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), { 
            status: 405, 
            headers: corsHeaders 
        });
    }
};
