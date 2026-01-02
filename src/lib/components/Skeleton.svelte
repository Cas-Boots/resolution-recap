<script lang="ts">
	interface Props {
		class?: string;
		width?: string;
		height?: string;
		rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
	}

	let { 
		class: className = '', 
		width = '100%', 
		height = '1rem',
		rounded = 'md'
	}: Props = $props();

	const roundedClasses = {
		none: '',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		'2xl': 'rounded-2xl',
		full: 'rounded-full'
	};
</script>

<div 
	class="animate-pulse bg-gray-200 dark:bg-gray-700 {roundedClasses[rounded]} {className}"
	style="width: {width}; height: {height};"
></div>

<style>
	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
