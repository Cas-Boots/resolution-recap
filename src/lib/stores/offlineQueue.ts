import { writable, get } from 'svelte/store';
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
}

const DB_NAME = 'recap-offline';
const STORE_NAME = 'pending-entries';
const DB_VERSION = 1;

// Store for tracking pending entries count
export const pendingEntriesCount = writable(0);
export const isOnline = writable(true);

let db: IDBDatabase | null = null;

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
	if (db) return db;
	
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		
		request.onerror = () => reject(request.error);
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
}

// Add entry to offline queue
export async function queueEntry(entry: Omit<QueuedEntry, 'id' | 'timestamp'>): Promise<void> {
	if (!browser) return;
	
	const db = await initDB();
	const queuedEntry: QueuedEntry = {
		...entry,
		id: crypto.randomUUID(),
		timestamp: Date.now()
	};
	
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.add(queuedEntry);
		
		request.onsuccess = () => {
			updatePendingCount();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

// Get all pending entries
export async function getPendingEntries(): Promise<QueuedEntry[]> {
	if (!browser) return [];
	
	const db = await initDB();
	
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();
		
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

// Remove entry from queue (after successful sync)
async function removeFromQueue(id: string): Promise<void> {
	if (!browser) return;
	
	const db = await initDB();
	
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(id);
		
		request.onsuccess = () => {
			updatePendingCount();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

// Update pending entries count
async function updatePendingCount(): Promise<void> {
	const entries = await getPendingEntries();
	pendingEntriesCount.set(entries.length);
}

// Sync pending entries to server
export async function syncPendingEntries(): Promise<{ synced: number; failed: number }> {
	if (!browser || !navigator.onLine) return { synced: 0, failed: 0 };
	
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
			} else {
				failed++;
			}
		} catch {
			failed++;
		}
	}
	
	return { synced, failed };
}

// Initialize online/offline listeners
export function initOfflineSupport(): void {
	if (!browser) return;
	
	// Set initial online status
	isOnline.set(navigator.onLine);
	
	// Listen for online/offline events
	window.addEventListener('online', async () => {
		isOnline.set(true);
		// Auto-sync when coming back online
		const result = await syncPendingEntries();
		if (result.synced > 0) {
			console.log(`Synced ${result.synced} offline entries`);
		}
	});
	
	window.addEventListener('offline', () => {
		isOnline.set(false);
	});
	
	// Initialize pending count
	updatePendingCount();
}

// Create entry with offline fallback
export async function createEntryWithOfflineFallback(
	personId: number,
	metricId: number,
	entryDate: string,
	notes?: string,
	tags?: string
): Promise<{ success: boolean; offline: boolean; data?: unknown }> {
	if (!browser) return { success: false, offline: false };
	
	// If online, try to submit directly
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
		} catch {
			// Fall through to offline queue
		}
	}
	
	// Queue for later sync
	await queueEntry({ personId, metricId, entryDate, notes, tags });
	return { success: true, offline: true };
}
