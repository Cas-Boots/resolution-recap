import worldCountries from 'world-countries';

export interface CountryInfo {
	code: string;
	name: string;
	flag: string;
	lat: number;
	lng: number;
}

function codeToFlagEmoji(code: string): string {
	if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
	const A = 0x1f1e6;
	const chars = [...code].map((char) => String.fromCodePoint(A + char.charCodeAt(0) - 65));
	return chars.join('');
}

const countryList: CountryInfo[] = worldCountries
	.filter((country) => /^[A-Z]{2}$/.test(country.cca2))
	.map((country) => ({
		code: country.cca2.toUpperCase(),
		name: country.name?.common ?? country.cca2,
		flag: country.flag || codeToFlagEmoji(country.cca2.toUpperCase()),
		lat: Array.isArray(country.latlng) && Number.isFinite(country.latlng[0]) ? country.latlng[0] : Number.NaN,
		lng: Array.isArray(country.latlng) && Number.isFinite(country.latlng[1]) ? country.latlng[1] : Number.NaN
	}))
	.sort((a, b) => a.name.localeCompare(b.name));

export function getSortedCountries(): CountryInfo[] {
	return countryList;
}
