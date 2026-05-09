import { env } from '$env/dynamic/private';

export function getBackupToken(url: URL, authHeader: string | null): string {
	const queryToken = url.searchParams.get('token');
	if (queryToken) return queryToken;
	if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
	return '';
}

export function isAuthorizedBackup(url: URL, authHeader: string | null): boolean {
	return getBackupToken(url, authHeader) === env.BACKUP_TOKEN;
}
