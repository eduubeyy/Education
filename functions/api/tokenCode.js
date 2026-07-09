export async function onRequest(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    if (context.request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const rtdb = context.env.FIREBASE_RTDB_URL;
        const secret = context.env.FIREBASE_SECRET;

        if (!rtdb || !secret) {
            return new Response(JSON.stringify({ success: false, error: "Configuration missing" }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const cleanRtdb = rtdb.endsWith('/') ? rtdb.slice(0, -1) : rtdb;

        if (context.request.method === "GET") {
            const tokensUrl = cleanRtdb + "/tokens.json?auth=" + secret;
            const gateUrl = cleanRtdb + "/token_gate.json?auth=" + secret;

            const tokensResp = await fetch(tokensUrl);
            const gateResp = await fetch(gateUrl);

            let gateStatus = "false";
            if (gateResp.ok) {
                gateStatus = await gateResp.json() || "false";
            }

            let token = "Babu Token";
            let tokenKey = null;

            if (tokensResp.ok) {
                const tokensData = await tokensResp.json();
                if (tokensData && typeof tokensData === "object") {
                    const keys = Object.keys(tokensData);
                    if (keys.length > 0) {
                        tokenKey = keys[0];
                        token = tokensData[tokenKey];
                    }
                }
            }

            if (token === "Babu Token" || !tokenKey) {
                const newToken = "NW/v3/3568" + Math.floor(100000 + Math.random() * 900000).toString();
                const pushUrl = cleanRtdb + "/tokens.json?auth=" + secret;
                await fetch(pushUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newToken)
                });
                token = newToken;
                gateStatus = "true";
                await fetch(gateUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify("true")
                });
            }

            return new Response(JSON.stringify({
                success: true,
                token: token,
                token_gate: gateStatus
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        if (context.request.method === "POST") {
            let body;
            try {
                body = await context.request.json();
            } catch (parseErr) {
                return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            if (!body.password || body.password !== "Haruna@66") {
                return new Response(JSON.stringify({ success: false, error: "Invalid password" }), {
                    status: 401,
                    headers: corsHeaders
                });
            }

            const action = body.action;

            if (action === "get_token") {
                const tokensUrl = cleanRtdb + "/tokens.json?auth=" + secret;
                const tokensResp = await fetch(tokensUrl);
                let token = "Babu Token";
                let tokenKey = null;

                if (tokensResp.ok) {
                    const tokensData = await tokensResp.json();
                    if (tokensData && typeof tokensData === "object") {
                        const keys = Object.keys(tokensData);
                        if (keys.length > 0) {
                            tokenKey = keys[0];
                            token = tokensData[tokenKey];
                        }
                    }
                }

                if (token === "Babu Token" || !tokenKey) {
                    const newToken = "NW/v3/3568" + Math.floor(100000 + Math.random() * 900000).toString();
                    const pushUrl = cleanRtdb + "/tokens.json?auth=" + secret;
                    await fetch(pushUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newToken)
                    });
                    token = newToken;
                    const gateUrl = cleanRtdb + "/token_gate.json?auth=" + secret;
                    await fetch(gateUrl, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify("true")
                    });
                }

                return new Response(JSON.stringify({
                    success: true,
                    token: token
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            if (action === "check_gate") {
                const gateUrl = cleanRtdb + "/token_gate.json?auth=" + secret;
                const gateResp = await fetch(gateUrl);
                let gateStatus = "false";
                if (gateResp.ok) {
                    gateStatus = await gateResp.json() || "false";
                }
                return new Response(JSON.stringify({
                    success: true,
                    token_needed: gateStatus === "true"
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            if (action === "close_gate") {
                const gateUrl = cleanRtdb + "/token_gate.json?auth=" + secret;
                await fetch(gateUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify("false")
                });
                return new Response(JSON.stringify({
                    success: true,
                    message: "Gate closed"
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
                status: 400,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
            status: 405,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
