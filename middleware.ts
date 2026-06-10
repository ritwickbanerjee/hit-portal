import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
    // --- DYNAMIC DOMAIN REDIRECTION LOGIC ---
    const now = new Date();
    // Use IST timezone since it's an Indian college
    const istString = now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const istTime = new Date(istString);
    const day = istTime.getDate();
    
    let targetDomain = "";
    if (day >= 8 && day <= 13) {
        targetDomain = "hit-portal-five.vercel.app";
    } else if (day >= 14 && day <= 19) {
        targetDomain = "hit-portal-four.vercel.app";
    } else if (day >= 20 && day <= 25) {
        targetDomain = "hit-portal-one.vercel.app";
    } else if (day >= 26) {
        targetDomain = "maths-hit-attendance-assignment-track.netlify.app";
    } else {
        // 1st - 7th
        targetDomain = "hit-portal-six.vercel.app";
    }

    const currentHost = req.headers.get('host') || req.nextUrl.host || "";
    
    // Check if redirect is needed
    // 1. Don't redirect localhost (for local development)
    // 2. Don't redirect if the current host is ALREADY the target domain (prevents infinite loop)
    // 3. To be absolutely safe against infinite loops on weird hostnames, explicitly check if currentHost doesn't contain targetDomain
    if (!currentHost.includes('localhost') && !currentHost.includes(targetDomain)) {
        const url = req.nextUrl.clone();
        url.host = targetDomain;
        url.protocol = 'https:';
        url.port = '';
        return NextResponse.redirect(url);
    }
    // --- END REDIRECTION LOGIC ---


    // --- API AUTHENTICATION LOGIC ---
    // Only run auth for /api/student and /api/admin
    if (req.nextUrl.pathname.startsWith('/api/student') || req.nextUrl.pathname.startsWith('/api/admin')) {
        // 1. Skip middleware for auth routes AND Admin API (handled by route headers)
        if (req.nextUrl.pathname.startsWith('/api/student/auth')) {
            return NextResponse.next();
        }

        // Allow public access to the master export API for Google Sheets Apps Script integration
        if (req.nextUrl.pathname.match(/^\/api\/admin\/routine-maker\/[^\/]+\/export\/master$/)) {
            return NextResponse.next();
        }

        // 2. Check for the token in cookies OR headers
        let token = req.cookies.get('auth_token')?.value;

        if (!token) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }

        try {
            // 2. Verify the token
            const { payload } = await jwtVerify(token, key);

            // 3. Clone request headers to inject user info
            const requestHeaders = new Headers(req.headers);
            requestHeaders.set('x-user-id', payload.userId as string);
            requestHeaders.set('x-user-role', payload.role as string);

            // SECURE ADMIN FIX: Override client-provided identity headers with verified JWT data
            if (payload.role === 'admin' && payload.email) {
                requestHeaders.set('x-user-email', payload.email as string);
                
                // If the client provided a global admin key, pass it through ONLY IF they are a valid admin.
                // The endpoints themselves double-check this key if needed.
                const clientGlobalKey = req.headers.get('x-global-admin-key');
                if (clientGlobalKey) {
                    requestHeaders.set('x-global-admin-key', clientGlobalKey);
                } else {
                    requestHeaders.delete('x-global-admin-key'); // Strip it just in case
                }
            } else {
                 // For students, ensure they can NEVER pass an x-user-email or x-global-admin-key spoofed header
                 requestHeaders.delete('x-user-email');
                 requestHeaders.delete('x-global-admin-key');
            }


            // 4. Return response with new headers
            if (req.nextUrl.pathname.startsWith('/api/admin') && payload.role !== 'admin') {
                return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
            }

            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });
        } catch (error) {
            console.error('Middleware Auth Error:', error);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }
    }

    // Default for non-API routes
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - icons (PWA icons)
         * - manifest.json (PWA manifest)
         */
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
    ],
};
