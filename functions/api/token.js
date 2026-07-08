export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "*";

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400"
                }
            });
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Content-Type": "application/json"
        };

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            let body;
            try {
                body = await request.json();
            } catch(parseErr) {
                return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            if (!body.password || body.password !== "@haruna66") {
                return new Response(JSON.stringify({ success: false, error: "Invalid access password" }), {
                    status: 401,
                    headers: corsHeaders
                });
            }

            const userToken = body.token;
            const action = body.action;

            const rtdbBase = (env.FIREBASE_RTDB_URL || "").replace(/\/+$/, "");
            const secret = env.FIREBASE_SECRET || "";

            if (!rtdbBase || !secret) {
                return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
                    status: 500,
                    headers: corsHeaders
                });
            }

            if (action === "verify") {
                const url = rtdbBase + "/tokens.json?auth=" + secret;
                const response = await fetch(url);
                
                if (!response.ok) {
                    return new Response(JSON.stringify({ success: false, error: "Token database unavailable with status: " + response.status }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
                
                const tokensData = await response.json();

                let tokenKey = null;
                if (tokensData && typeof tokensData === "object") {
                    for (const key in tokensData) {
                        if (tokensData[key] === userToken) {
                            tokenKey = key;
                            break;
                        }
                    }
                }

                if (tokenKey) {
                    const deleteUrl = rtdbBase + "/tokens/" + tokenKey + ".json?auth=" + secret;
                    await fetch(deleteUrl, { method: "DELETE" });

                    const newToken = "NW/v3/3568" + Math.floor(100000 + Math.random() * 900000).toString();
                    const pushUrl = rtdbBase + "/tokens.json?auth=" + secret;
                    await fetch(pushUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newToken)
                    });

                    const checkTokenGate = rtdbBase + "/token_gate.json?auth=" + secret;
                    await fetch(checkTokenGate, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify("false")
                    });

                    return new Response(JSON.stringify({ 
                        success: true, 
                        newToken: newToken,
                        message: "Token verified and replaced successfully" 
                    }), {
                        status: 200,
                        headers: corsHeaders
                    });
                } else {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        error: "Invalid or expired token" 
                    }), {
                        status: 200,
                        headers: corsHeaders
                    });
                }
            }

            if (action === "generate") {
                const newToken = "NW/v3/3568" + Math.floor(100000 + Math.random() * 900000).toString();
                const pushUrl = rtdbBase + "/tokens.json?auth=" + secret;
                const pushResp = await fetch(pushUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newToken)
                });

                if (!pushResp.ok) {
                    return new Response(JSON.stringify({ success: false, error: "Failed to generate token" }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }

                const checkTokenGate = rtdbBase + "/token_gate.json?auth=" + secret;
                await fetch(checkTokenGate, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify("true")
                });

                return new Response(JSON.stringify({ 
                    success: true, 
                    token: newToken,
                    message: "New token generated" 
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            if (action === "check_gate") {
                const gateUrl = rtdbBase + "/token_gate.json?auth=" + secret;
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

            return new Response(JSON.stringify({ success: false, error: "Invalid action: " + action }), {
                status: 400,
                headers: corsHeaders
            });

        } catch (e) {
            return new Response(JSON.stringify({ success: false, error: "Server error: " + e.message }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};
