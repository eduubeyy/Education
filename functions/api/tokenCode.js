export async function onRequest(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
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
            return new Response(JSON.stringify({ error: "Configuration missing" }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const cleanRtdb = rtdb.endsWith('/') ? rtdb.slice(0, -1) : rtdb;
        const firebaseUrl = `${cleanRtdb}/auth_tokens.json?auth=${secret}`;

        const firebaseResponse = await fetch(firebaseUrl);
        
        if (!firebaseResponse.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch from Firebase", code: firebaseResponse.status }), {
                status: firebaseResponse.status,
                headers: corsHeaders
            });
        }

        const data = await firebaseResponse.json();
        
        let token = "Babu Token";
        if (data) {
            if (data.idToken) {
                token = data.idToken;
            } else if (typeof data === 'object') {
                const keys = Object.keys(data);
                if (keys.length > 0 && data[keys[0]].idToken) {
                    token = data[keys[0]].idToken;
                }
            }
        }

        const responsePayload = {
            code: firebaseResponse.status,
            token: token
        };

        return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, code: 500 }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
