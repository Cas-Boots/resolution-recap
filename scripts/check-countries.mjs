import worldCountries from 'world-countries';

const iso2Countries = worldCountries.filter((country) => /^[A-Z]{2}$/.test(country.cca2));
const uniqueIso2 = new Set(iso2Countries.map((country) => country.cca2.toUpperCase()));
const withCoordinates = iso2Countries.filter(
	(country) =>
		Array.isArray(country.latlng) &&
		country.latlng.length === 2 &&
		Number.isFinite(country.latlng[0]) &&
		Number.isFinite(country.latlng[1])
);

const result = {
	totalDatasetEntries: worldCountries.length,
	iso2Entries: iso2Countries.length,
	uniqueIso2Codes: uniqueIso2.size,
	entriesWithCoordinates: withCoordinates.length,
	entriesWithoutCoordinates: iso2Countries.length - withCoordinates.length
};

console.log('🌍 Countries dataset check');
console.log(JSON.stringify(result, null, 2));

if (uniqueIso2.size < 240) {
	console.error('❌ Unexpectedly low ISO2 country count. Please verify world-countries dataset.');
	process.exit(1);
}

console.log('✅ Countries dataset looks healthy.');
