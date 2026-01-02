/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create unique cache names
const CACHE_NAME = `cache-${version}`;
const STATIC_ASSETS = [...build, ...files];

// Install event - cache static assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}).then(() => {
			// Force the waiting service worker to become the active service worker
			sw.skipWaiting();
		})
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			);
		}).then(() => {
			// Take control of all clients immediately
			sw.clients.claim();
		})
	);
});

// Fetch event - serve from cache, fallback to network
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}
	
	// Skip API requests - these should always go to network
	if (url.pathname.includes('/api/')) {
		return;
	}
	
	// Skip external requests
	if (url.origin !== location.origin) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached response if found
			if (cachedResponse) {
				// Also update the cache in the background (stale-while-revalidate)
				event.waitUntil(
					fetch(event.request).then((response) => {
						if (response.ok) {
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(event.request, response.clone());
							});
						}
					}).catch(() => {
						// Network error, ignore - we already have cached version
					})
				);
				return cachedResponse;
			}
			
			// No cache - try network
			return fetch(event.request).then((response) => {
				// Don't cache non-successful responses
				if (!response.ok) {
					return response;
				}
				
				// Clone the response since it can only be consumed once
				const responseToCache = response.clone();
				
				// Cache HTML pages and other static assets
				if (
					event.request.destination === 'document' ||
					event.request.destination === 'style' ||
					event.request.destination === 'script' ||
					event.request.destination === 'image' ||
					event.request.destination === 'font'
				) {
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
				}
				
				return response;
			}).catch(() => {
				// Network failed, try to return a cached fallback for HTML pages
				if (event.request.destination === 'document') {
					return caches.match('/').then((response) => {
						if (response) return response;
						// Return a basic offline page if nothing is cached
						return new Response(
							'<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
							{ headers: { 'Content-Type': 'text/html' } }
						);
					});
				}
				// For other resources, return a network error
				return new Response('Network error', { status: 503 });
			});
		})
	);
});

// Listen for messages from the client
sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
