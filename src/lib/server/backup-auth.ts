import { env } from '$env/dynamic/private';
import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedBackup(_url: URL, authHeader: string | null): boolean {
	const expected = env.BACKUP_TOKEN;
	if (!expected || expected.length < 32) return false;
	const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	if (!provided || provided.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
