<script lang="ts">
	import { base } from '$app/paths';

	let loading = $state(false);
	let success = $state(false);

	async function downloadExport() {
		loading = true;
		
		try {
			const res = await fetch(`${base}/api/export`);
			
			if (res.ok) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `resolution-recap-backup-${new Date().toISOString().split('T')[0]}.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				success = true;
				setTimeout(() => success = false, 3000);
			}
		} catch (e) {
			console.error('Export failed:', e);
		} finally {
			loading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-2xl shadow-lg p-6">
		<h1 class="text-2xl font-bold text-gray-800">💾 Data Export</h1>
		<p class="text-gray-500 mt-1">Download a full backup of all data</p>
	</div>

	<div class="bg-white rounded-xl shadow-lg p-6">
		<div class="text-center space-y-4">
			<div class="text-6xl">📦</div>
			<div>
				<h2 class="text-lg font-semibold text-gray-800">Manual Backup</h2>
				<p class="text-gray-500 mt-1">
					Download a JSON file containing all seasons, people, metrics, and entries.
				</p>
			</div>

			{#if success}
				<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700">
					✅ Backup downloaded successfully!
				</div>
			{/if}

			<button
				onclick={downloadExport}
				disabled={loading}
				class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
			>
				{loading ? 'Preparing...' : '⬇️ Download Backup'}
			</button>
		</div>
	</div>

	<div class="bg-white rounded-xl shadow-lg p-6">
		<h2 class="text-lg font-semibold text-gray-800 mb-3">🔄 Automatic Backups</h2>
		<p class="text-gray-600 mb-4">
			Automatic daily backups are configured via GitHub Actions. The backup runs every day at midnight
			and commits the data to the repository's <code class="bg-gray-100 px-1 rounded">backups/</code> folder.
		</p>
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
			<strong>💡 Tip:</strong> Make sure the <code class="bg-blue-100 px-1 rounded">BACKUP_TOKEN</code> environment 
			variable is set in both Dokploy and GitHub Actions secrets for automatic backups to work.
		</div>
	</div>
</div>
