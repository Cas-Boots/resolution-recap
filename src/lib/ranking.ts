/**
 * Calculate rank with tie handling - items with equal values get the same rank
 * @param index - The index of the item in the sorted array
 * @param items - Array of items sorted by the value field (descending)
 * @param getValue - Function to get the value to compare for ranking
 * @returns The rank (1-based)
 */
export function getRank<T>(index: number, items: T[], getValue: (item: T) => number): number {
	if (index === 0) return 1;
	const currentValue = getValue(items[index]);
	const previousValue = getValue(items[index - 1]);
	if (currentValue === previousValue) {
		return getRank(index - 1, items, getValue);
	}
	return index + 1;
}

/**
 * Get the appropriate medal emoji for a rank
 * @param rank - The rank (1-based)
 * @returns Medal emoji or empty string
 */
export function getMedal(rank: number): string {
	if (rank === 1) return '🥇';
	if (rank === 2) return '🥈';
	if (rank === 3) return '🥉';
	return '';
}

/**
 * Get display text for rank (medal or number)
 * @param rank - The rank (1-based)
 * @returns Medal emoji or rank number with #
 */
export function getRankDisplay(rank: number): string {
	const medal = getMedal(rank);
	return medal || `#${rank}`;
}
