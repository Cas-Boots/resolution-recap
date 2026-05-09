import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

function getSecret(): string {
	const secret = env.AUTH_SECRET;
	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('AUTH_SECRET env var must be set in production');
	}
	return secret || 'dev-only-insecure-placeholder';
}

export function signRole(role: 'tracker' | 'admin'): string {
	const mac = createHmac('sha256', getSecret()).update(role).digest('base64url');
	return `${role}.${mac}`;
}

export function verifyRole(cookieValue: string | undefined): 'tracker' | 'admin' | undefined {
	if (!cookieValue) return undefined;
	const dotIdx = cookieValue.lastIndexOf('.');
	if (dotIdx < 0) return undefined;
	const role = cookieValue.slice(0, dotIdx);
	const mac = cookieValue.slice(dotIdx + 1);
	if (role !== 'tracker' && role !== 'admin') return undefined;
	const expectedMac = createHmac('sha256', getSecret()).update(role).digest('base64url');
	if (mac.length !== expectedMac.length) return undefined;
	try {
		if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return undefined;
	} catch {
		return undefined;
	}
	return role as 'tracker' | 'admin';
}

// Require one of the given roles; throws 401 (unauthenticated) or 403 (wrong role)
export function requireRole(
	locals: { role?: 'tracker' | 'admin' },
	...roles: ('tracker' | 'admin')[]
): void {
	if (!roles.some(r => r === locals.role)) {
		if (!locals.role) throw error(401, 'Authentication required');
		throw error(403, 'Forbidden');
	}
}

// In-memory rate limiter for PIN auth (5 attempts per 15 min per IP)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkAuthRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = authAttempts.get(ip);
	if (!entry || entry.resetAt <= now) {
		authAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}
	if (entry.count >= MAX_ATTEMPTS) return false;
	entry.count++;
	return true;
}

export function resetAuthRateLimit(ip: string): void {
	authAttempts.delete(ip);
}
