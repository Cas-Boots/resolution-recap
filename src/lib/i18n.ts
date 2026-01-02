// Internationalization support for the app

export type Locale = 'en' | 'nl';

export interface Translations {
	// General
	appName: string;
	loading: string;
	save: string;
	cancel: string;
	delete: string;
	edit: string;
	add: string;
	share: string;
	copy: string;
	copied: string;
	
	// Navigation
	nav: {
		home: string;
		stats: string;
		add: string;
		settings: string;
		history: string;
		countries: string;
	};
	
	// Dashboard
	dashboard: {
		title: string;
		quickAdd: string;
		todayProgress: string;
		weekProgress: string;
		streak: string;
		totalEntries: string;
		noEntries: string;
		welcome: string;
		welcomeSubtitle: string;
		todaysActivity: string;
		noActivityYet: string;
		getStarted: string;
		tapToLog: string;
		allTime: string;
		thisMonth: string;
		thisWeek: string;
		today: string;
		noActiveSeason: string;
		entries: string;
		entry: string;
		recentActivity: string;
		noRecentEntries: string;
		person: string;
		tapQuickAdd: string;
		selectActivity: string;
		buildStreaks: string;
		logDaily: string;
		reachGoals: string;
		watchProgress: string;
		needAdjust: string;
		fullForm: string;
	};
	
	// Stats
	stats: {
		leaderboard: string;
		overview: string;
		goals: string;
		monthly: string;
		streaks: string;
		calendar: string;
		insights: string;
		compare: string;
		total: string;
		projected: string;
		pace: string;
		dayOf: string;
		previousSeasons: string;
		seeHowWeDid: string;
	};
	
	// Metrics
	metrics: {
		sporting: string;
		cakesEaten: string;
	};
	
	// Sports
	sports: {
		running: string;
		cycling: string;
		swimming: string;
		gym: string;
		yoga: string;
		hiking: string;
		tennis: string;
		padel: string;
		football: string;
		basketball: string;
		hockey: string;
		volleyball: string;
		climbing: string;
		bouldering: string;
		skiing: string;
		skating: string;
		boxing: string;
		martialArts: string;
		dance: string;
		other: string;
	};
	
	// Achievements
	achievements: {
		title: string;
		unlocked: string;
		locked: string;
		firstSteps: string;
		gettingStarted: string;
		quarterCentury: string;
		halfCentury: string;
		centuryClub: string;
		doubleCentury: string;
		hatTrick: string;
		weekWarrior: string;
		fortnightFighter: string;
		monthMaster: string;
	};
	
	// Time
	time: {
		today: string;
		yesterday: string;
		thisWeek: string;
		thisMonth: string;
		days: string;
		weeks: string;
		months: string;
	};
	
	// Days of week
	days: {
		sunday: string;
		monday: string;
		tuesday: string;
		wednesday: string;
		thursday: string;
		friday: string;
		saturday: string;
	};
	
	// Months
	months: {
		january: string;
		february: string;
		march: string;
		april: string;
		may: string;
		june: string;
		july: string;
		august: string;
		september: string;
		october: string;
		november: string;
		december: string;
	};
}

export const translations: Record<Locale, Translations> = {
	en: {
		appName: 'Resolution Recap',
		loading: 'Loading...',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
		edit: 'Edit',
		add: 'Add',
		share: 'Share',
		copy: 'Copy',
		copied: 'Copied!',
		
		nav: {
			home: 'Home',
			stats: 'Stats',
			add: 'Add Entry',
			settings: 'Settings',
			history: 'History',
			countries: 'Countries',
		},
		
		dashboard: {
			title: 'Dashboard',
			quickAdd: 'Quick Add',
			todayProgress: "Today's Progress",
			weekProgress: 'This Week',
			streak: 'Streak',
			totalEntries: 'Total Entries',
			noEntries: 'No entries yet',
			welcome: 'Welcome to Resolution Recap!',
			welcomeSubtitle: 'Track your progress and compete with friends',
			todaysActivity: "Today's Activity",
			noActivityYet: 'No activity yet today',
			getStarted: 'Use Quick Add below to get started!',
			tapToLog: 'tap to log today',
			allTime: 'All Time',
			thisMonth: 'This Month',
			thisWeek: 'This Week',
			today: 'Today',
			noActiveSeason: 'No active season. Ask an admin to set one up.',
			entries: 'entries',
			entry: 'entry',
			recentActivity: 'Recent Activity',
			noRecentEntries: 'No recent entries',
			person: 'Person',
			tapQuickAdd: 'Tap Quick Add',
			selectActivity: 'Select a person and activity type to log',
			buildStreaks: 'Build Streaks',
			logDaily: 'Log daily to build your 🔥 streak',
			reachGoals: 'Reach Goals',
			watchProgress: 'Watch your progress grow over time',
			needAdjust: 'Need to adjust the date or add notes? Use the',
			fullForm: 'full form',
		},
		
		stats: {
			leaderboard: 'Leaderboard',
			overview: 'Overview',
			goals: 'Goals',
			monthly: 'Monthly',
			streaks: 'Streaks',
			calendar: 'Calendar',
			insights: 'Insights',
			compare: 'Compare',
			total: 'Total',
			projected: 'Projected',
			pace: 'pace',
			dayOf: 'Day',
			previousSeasons: 'Previous Seasons',
			seeHowWeDid: 'See how we did in 2024 (🎂 Cakes) and 2025 (🏃 Sporting)',
		},
		
		metrics: {
			sporting: 'Sporting',
			cakesEaten: 'Cakes Eaten',
		},
		
		sports: {
			running: 'Running',
			cycling: 'Cycling',
			swimming: 'Swimming',
			gym: 'Gym',
			yoga: 'Yoga',
			hiking: 'Hiking',
			tennis: 'Tennis',
			padel: 'Padel',
			football: 'Football',
			basketball: 'Basketball',
			hockey: 'Hockey',
			volleyball: 'Volleyball',
			climbing: 'Climbing',
			bouldering: 'Bouldering',
			skiing: 'Skiing',
			skating: 'Skating',
			boxing: 'Boxing',
			martialArts: 'Martial Arts',
			dance: 'Dance',
			other: 'Other',
		},
		
		achievements: {
			title: 'Achievements',
			unlocked: 'Unlocked',
			locked: 'Locked',
			firstSteps: 'First Steps',
			gettingStarted: 'Getting Started',
			quarterCentury: 'Quarter Century',
			halfCentury: 'Half Century',
			centuryClub: 'Century Club',
			doubleCentury: 'Double Century',
			hatTrick: 'Hat Trick',
			weekWarrior: 'Week Warrior',
			fortnightFighter: 'Fortnight Fighter',
			monthMaster: 'Month Master',
		},
		
		time: {
			today: 'Today',
			yesterday: 'Yesterday',
			thisWeek: 'This Week',
			thisMonth: 'This Month',
			days: 'days',
			weeks: 'weeks',
			months: 'months',
		},
		
		days: {
			sunday: 'Sunday',
			monday: 'Monday',
			tuesday: 'Tuesday',
			wednesday: 'Wednesday',
			thursday: 'Thursday',
			friday: 'Friday',
			saturday: 'Saturday',
		},
		
		months: {
			january: 'January',
			february: 'February',
			march: 'March',
			april: 'April',
			may: 'May',
			june: 'June',
			july: 'July',
			august: 'August',
			september: 'September',
			october: 'October',
			november: 'November',
			december: 'December',
		},
	},
	
	nl: {
		appName: 'Voornemens Recap',
		loading: 'Laden...',
		save: 'Opslaan',
		cancel: 'Annuleren',
		delete: 'Verwijderen',
		edit: 'Bewerken',
		add: 'Toevoegen',
		share: 'Delen',
		copy: 'Kopiëren',
		copied: 'Gekopieerd!',
		
		nav: {
			home: 'Home',
			stats: 'Statistieken',
			add: 'Toevoegen',
			settings: 'Instellingen',
			history: 'Geschiedenis',
			countries: 'Landen',
		},
		
		dashboard: {
			title: 'Dashboard',
			quickAdd: 'Snel Toevoegen',
			todayProgress: 'Voortgang Vandaag',
			weekProgress: 'Deze Week',
			streak: 'Reeks',
			totalEntries: 'Totaal Entries',
			noEntries: 'Nog geen entries',
			welcome: 'Welkom bij Voornemens Recap!',
			welcomeSubtitle: 'Volg je voortgang en strijd met vrienden',
			todaysActivity: 'Activiteit Vandaag',
			noActivityYet: 'Nog geen activiteit vandaag',
			getStarted: 'Gebruik Snel Toevoegen hieronder om te beginnen!',
			tapToLog: 'tik om vandaag te loggen',
			allTime: 'Altijd',
			thisMonth: 'Deze Maand',
			thisWeek: 'Deze Week',
			today: 'Vandaag',
			noActiveSeason: 'Geen actief seizoen. Vraag een admin om er een aan te maken.',
			entries: 'entries',
			entry: 'entry',
			recentActivity: 'Recente Activiteit',
			noRecentEntries: 'Geen recente entries',
			person: 'Persoon',
			tapQuickAdd: 'Tik Snel Toevoegen',
			selectActivity: 'Selecteer een persoon en activiteit om te loggen',
			buildStreaks: 'Bouw Reeksen',
			logDaily: 'Log dagelijks om je 🔥 reeks te bouwen',
			reachGoals: 'Bereik Doelen',
			watchProgress: 'Bekijk hoe je voortgang groeit',
			needAdjust: 'Datum aanpassen of notities toevoegen? Gebruik het',
			fullForm: 'volledige formulier',
		},
		
		stats: {
			leaderboard: 'Ranglijst',
			overview: 'Overzicht',
			goals: 'Doelen',
			monthly: 'Maandelijks',
			streaks: 'Reeksen',
			calendar: 'Kalender',
			insights: 'Inzichten',
			compare: 'Vergelijken',
			total: 'Totaal',
			projected: 'Verwacht',
			pace: 'tempo',
			dayOf: 'Dag',
			previousSeasons: 'Vorige Seizoenen',
			seeHowWeDid: 'Bekijk hoe we het deden in 2024 (🎂 Taart) en 2025 (🏃 Gesport)',
		},
		
		metrics: {
			sporting: 'Gesport',
			cakesEaten: 'Taart gegeten',
		},
		
		sports: {
			running: 'Hardlopen',
			cycling: 'Fietsen',
			swimming: 'Zwemmen',
			gym: 'Fitness',
			yoga: 'Yoga',
			hiking: 'Wandelen',
			tennis: 'Tennis',
			padel: 'Padel',
			football: 'Voetbal',
			basketball: 'Basketbal',
			hockey: 'Hockey',
			volleyball: 'Volleybal',
			climbing: 'Klimmen',
			bouldering: 'Boulderen',
			skiing: 'Skiën',
			skating: 'Schaatsen',
			boxing: 'Boksen',
			martialArts: 'Vechtsporten',
			dance: 'Dansen',
			other: 'Anders',
		},
		
		achievements: {
			title: 'Prestaties',
			unlocked: 'Behaald',
			locked: 'Vergrendeld',
			firstSteps: 'Eerste Stappen',
			gettingStarted: 'Aan de Slag',
			quarterCentury: 'Kwart Eeuw',
			halfCentury: 'Halve Eeuw',
			centuryClub: 'Eeuw Club',
			doubleCentury: 'Dubbele Eeuw',
			hatTrick: 'Hattrick',
			weekWarrior: 'Week Strijder',
			fortnightFighter: 'Twee Weken Vechter',
			monthMaster: 'Maand Meester',
		},
		
		time: {
			today: 'Vandaag',
			yesterday: 'Gisteren',
			thisWeek: 'Deze Week',
			thisMonth: 'Deze Maand',
			days: 'dagen',
			weeks: 'weken',
			months: 'maanden',
		},
		
		days: {
			sunday: 'Zondag',
			monday: 'Maandag',
			tuesday: 'Dinsdag',
			wednesday: 'Woensdag',
			thursday: 'Donderdag',
			friday: 'Vrijdag',
			saturday: 'Zaterdag',
		},
		
		months: {
			january: 'Januari',
			february: 'Februari',
			march: 'Maart',
			april: 'April',
			may: 'Mei',
			june: 'Juni',
			july: 'Juli',
			august: 'Augustus',
			september: 'September',
			october: 'Oktober',
			november: 'November',
			december: 'December',
		},
	},
};

// Get translation for current locale
export function t(locale: Locale): Translations {
	return translations[locale];
}

// Metric object interface for translation
export interface MetricWithTranslation {
	name: string;
	name_nl?: string | null;
}

// Translate metric names using database translations (preferred) or fallback to hardcoded
export function translateMetric(metricName: string, locale: Locale, nameNl?: string | null): string {
	// If Dutch locale and we have a database translation, use it
	if (locale === 'nl' && nameNl) {
		return nameNl;
	}
	
	// Fallback to hardcoded translations for legacy support
	const key = metricName
		.toLowerCase()
		.replace(/\s+(.)/g, (_, char) => char.toUpperCase())
		.replace(/\s+/g, '') as keyof Translations['metrics'];
	
	const metricsTranslations = translations[locale].metrics as Record<string, string>;
	if (metricsTranslations[key]) {
		return metricsTranslations[key];
	}
	
	return metricName;
}

// Translate using a metric object directly
export function translateMetricObj(metric: MetricWithTranslation, locale: Locale): string {
	return translateMetric(metric.name, locale, metric.name_nl);
}

// Format number with locale-specific formatting
export function formatNumber(num: number, locale: Locale): string {
	return num.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US');
}

// Format date with locale-specific formatting
export function formatDate(date: Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
	return date.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-US', options);
}
