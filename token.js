export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
                status: 45,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        try {
            const body = await request.json();
            const userToken = body.token;
            const action = body.action;

            const rtdb = env.FIREBASE_RTDB_URL;
            const secret = env.FIREBASE_SECRET;

            if (action === "verify") {
                const cleanRtdb = rtdb.endsWith('/') ? rtdb : rtdb + '/';
                const url = `${cleanRtdb}tokens.json?auth=${secret}`;
                
                const response = await fetch(url);
                const tokensData = await response.json();

                let tokenKey = null;
                if (tokensData) {
                    for (const key in tokensData) {
                        if (tokensData[key] === userToken) {
                            tokenKey = key;
                            break;
                        }
                    }
                }

                if (tokenKey) {
                    const deleteUrl = `${cleanRtdb}tokens/${tokenKey}.json?auth=${secret}`;
                    await fetch(deleteUrl, { method: "DELETE" });

                    const newToken = "NW/v3/3568" + Math.floor(100000 + Math.random() * 900000);
                    const pushUrl = `${cleanRtdb}tokens.json?auth=${secret}`;
                    await fetch(pushUrl, {
                        method: "POST",
                        body: JSON.stringify(newToken)
                    });

                    return new Response(JSON.stringify({ success: true, newToken: newToken }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                } else {
                    return new Response(JSON.stringify({ success: false, error: "Invalid Token" }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }
            }

            return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });

        } catch (e) {
            return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};
