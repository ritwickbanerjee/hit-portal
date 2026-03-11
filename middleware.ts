import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
    // 1. Skip middleware for auth routes AND Admin API (handled by route headers)
    if (req.nextUrl.pathname.startsWith('/api/student/auth')) {
        return NextResponse.next();
    }

    if (req.nextUrl.pathname.startsWith('/api/admin')) {
        // We no longer allow legacy admin auth headers to bypass JWT check.
        // The token MUST be verified for any admin route.
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

        console.log(`[Middleware] Authenticated User: ${payload.userId} (${payload.role})`);

        // 4. Return response with new headers
        if (req.nextUrl.pathname.startsWith('/api/admin') && payload.role !== 'admin') {
            console.log(`[Middleware] Blocked unauthorized admin access from ${payload.userId} (${payload.role})`);
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

// Only run middleware on API routes that need protection
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (authentication routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/api/student/:path*',
        '/api/admin/:path*',
    ],
};
