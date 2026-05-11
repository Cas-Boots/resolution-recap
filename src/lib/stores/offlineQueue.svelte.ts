import { browser } from '$app/environment';
import { base } from '$app/paths';

interface QueuedEntry {
	id: string;
	personId: number;
	metricId: number;
	entryDate: string;
	notes?: string;
	tags?: string;
	timestamp: number;
	attempts?: number;
}

const MAX_ATTEMPTS = 5;

const DB_NAME = 'recap-offline';
const STORE_NAME = 'pending-entries';
const DB_VERSION = 1;

export let pendingEntriesCount = $state(0);
export let isOnline = $state(true);

let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;
let syncInFlight: Promise<{ synced: number; failed: number }> | null = null;
let listenersInitialized = false;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

async function initDB(): Promise<IDBDatabase> {
	if (db) return db;
	if (dbInitPromise) return dbInitPromise;

	dbInitPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			dbInitPromise = null;
			reject(request.error);
		};
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;
			if (!database.objectStoreNames.contains(STORE_NAME)) {
				database.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
	return dbInitPromise;
}

export async function queueEntry(entry: Omit<QueuedEntry, 'id' | 'timestamp'>): Promise<void> {
	if (!browser) return;

	const database = await initDB();
	const queuedEntry: QueuedEntry = {
		...entry,
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		attempts: 0
	};

	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.add(queuedEntry);

		request.onsuccess = () => {
			updatePendingCount();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

export async function getPendingEntries(): Promise<QueuedEntry[]> {
	if (!browser) return [];

	const database = await initDB();

	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function updateQueueEntry(entry: QueuedEntry): Promise<void> {
	if (!browser) return;
	const database = await initDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.put(entry);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

async function removeFromQueue(id: string): Promise<void> {
	if (!browser) return;

	const database = await initDB();

	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(id);

		request.onsuccess = () => {
			updatePendingCount();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

async function updatePendingCount(): Promise<void> {
	const entries = await getPendingEntries();
	pendingEntriesCount = entries.length;
}

export async function syncPendingEntries(): Promise<{ synced: number; failed: number }> {
	if (!browser || !navigator.onLine) return { synced: 0, failed: 0 };

	if (syncInFlight) return syncInFlight;

	syncInFlight = (async () => {
		const entries = await getPendingEntries();
		let synced = 0;
		let failed = 0;

		for (const entry of entries) {
			try {
				const res = await fetch(`${base}/api/entries`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						personId: entry.personId,
						metricId: entry.metricId,
						entryDate: entry.entryDate,
						notes: entry.notes,
						tags: entry.tags
					})
				});

				if (res.ok) {
					await removeFromQueue(entry.id);
					synced++;
				} else if (res.status >= 400 && res.status < 500) {
					const updated = { ...entry, attempts: (entry.attempts ?? 0) + 1 };
					if (updated.attempts >= MAX_ATTEMPTS) {
						await removeFromQueue(entry.id);
					} else {
						await updateQueueEntry(updated);
					}
					failed++;
				} else {
					failed++;
				}
			} catch {
				failed++;
			}
		}

		const remaining = await getPendingEntries();
		if (remaining.length > 0 && navigator.onLine) {
			syncInFlight = null;
			return syncPendingEntries().then(r => ({ synced: synced + r.synced, failed: failed + r.failed }));
		}

		return { synced, failed };
	})().finally(() => {
		syncInFlight = null;
	});

	return syncInFlight;
}

export function initOfflineSupport(): (() => void) | void {
	if (!browser) return;
	if (listenersInitialized) return;
	listenersInitialized = true;

	isOnline = navigator.onLine;

	onlineHandler = async () => {
		isOnline = true;
		const result = await syncPendingEntries();
		if (result.synced > 0) {
			console.log(`Synced ${result.synced} offline entries`);
		}

		window.dispatchEvent(
			new CustomEvent('offline-sync-complete', {
				detail: result
			})
		);
	};

	offlineHandler = () => {
		isOnline = false;
	};

	window.addEventListener('online', onlineHandler);
	window.addEventListener('offline', offlineHandler);

	updatePendingCount();

	return () => {
		if (!onlineHandler || !offlineHandler) return;
		window.removeEventListener('online', onlineHandler);
		window.removeEventListener('offline', offlineHandler);
		onlineHandler = null;
		offlineHandler = null;
		listenersInitialized = false;
	};
}

export async function createEntryWithOfflineFallback(
	personId: number,
	metricId: number,
	entryDate: string,
	notes?: string,
	tags?: string
): Promise<{ success: boolean; offline: boolean; data?: unknown }> {
	if (!browser) return { success: false, offline: false };

	if (navigator.onLine) {
		try {
			const res = await fetch(`${base}/api/entries`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ personId, metricId, entryDate, notes, tags })
			});
			if (res.ok) {
				const data = await res.json();
				return { success: true, offline: false, data };
			}
			if (res.status >= 400 && res.status < 500) {
				return { success: false, offline: false };
			}
		} catch {
			// Network error — fall through to offline queue
		}
	}

	await queueEntry({ personId, metricId, entryDate, notes, tags });
	return { success: true, offline: true };
}
