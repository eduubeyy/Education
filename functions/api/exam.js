export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    const allowedOrigins = ["https://educationv2.pages.dev", "http://localhost:8080"];
    
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400"
            }
        });
    }

    const corsHeaders = {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
        "Content-Type": "application/json"
    };

    const rtdb = env.FIREBASE_RTDB_URL.replace(/\/$/, "");
    const secret = env.FIREBASE_SECRET;

    if (request.method === "GET") {
        try {
            const lookupUrl = `${rtdb}/Exam_Data.json?auth=${secret}`;
            const fetchResp = await fetch(lookupUrl);
            const dbData = await fetchResp.json() || {};
            
            const total = dbData.Total_Exam ? (dbData.Total_Exam.count || 0) : 0;
            const flatUsers = [];
            
            ["Neco", "Waec"].forEach(body => {
                if (dbData[body]) {
                    Object.keys(dbData[body]).forEach(sid => {
                        flatUsers.push({
                            name: dbData[body][sid].candidate_name,
                            secureId: sid,
                            code: dbData[body][sid].success_code
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
            const targetBranch = body.examBody.toLowerCase() === "neco" ? "Neco" : "Waec";
            const secureId = body.secureId;

            const codeSeed = Math.floor(100000 + Math.random() * 900000).toString();

            const nodeUrl = `${rtdb}/Exam_Data/${targetBranch}/${secureId}.json?auth=${secret}`;
            const saveRecord = await fetch(nodeUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name: body.candidate_name,
                    exam_number: body.exam_number,
                    exam_year: body.exam_year,
                    exam_type: body.exam_type,
                    school_number: body.school_number,
                    school_name: body.school_name,
                    gender: body.gender,
                    dob: body.dob,
                    subjects: body.subjects,
                    qr_link: body.qr_link,
                    success_code: codeSeed
                })
            });

            if (!saveRecord.ok) throw new Error("Data serialization injection breakdown.");

            const counterUrl = `${rtdb}/Exam_Data/Total_Exam/count.json?auth=${secret}`;
            const counterResp = await fetch(counterUrl);
            let currentCount = await counterResp.json() || 0;
            currentCount++;

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
            return new Response(JSON.stringify({ success: false, error: err.message }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
}
