import { env } from '$env/dynamic/private';

function getBackupToken(url: URL, authHeader: string | null): string {
	const queryToken = url.searchParams.get('token');
	if (queryToken) return queryToken;
	if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
	return '';
}

export function isAuthorizedBackup(url: URL, authHeader: string | null): boolean {
	const expected = env.BACKUP_TOKEN;
	if (!expected) return false;
	return getBackupToken(url, authHeader) === expected;
}
