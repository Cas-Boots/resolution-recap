import * as v from 'valibot';

export const EntryCreateSchema = v.object({
	personId: v.pipe(v.number(), v.integer()),
	metricId: v.pipe(v.number(), v.integer()),
	entryDate: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be YYYY-MM-DD')),
	notes: v.optional(v.string()),
	tags: v.optional(v.union([v.string(), v.array(v.string())]))
});

export const EntryUpdateSchema = v.object({
	id: v.pipe(v.number(), v.integer()),
	personId: v.pipe(v.number(), v.integer()),
	metricId: v.pipe(v.number(), v.integer()),
	entryDate: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be YYYY-MM-DD')),
	tags: v.optional(v.union([v.string(), v.array(v.string())]))
});

export const EntryDeleteSchema = v.object({
	id: v.optional(v.pipe(v.number(), v.integer())),
	ids: v.optional(v.array(v.pipe(v.number(), v.integer()))),
	action: v.optional(v.string())
});

export const PersonCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1)),
	emoji: v.optional(v.string())
});

export const PersonUpdateSchema = v.object({
	id: v.pipe(v.number(), v.integer()),
	name: v.pipe(v.string(), v.minLength(1)),
	isActive: v.optional(v.boolean()),
	emoji: v.optional(v.string())
});

export const MetricCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1)),
	emoji: v.optional(v.string()),
	name_nl: v.optional(v.string())
});

export const MetricUpdateSchema = v.object({
	id: v.pipe(v.number(), v.integer()),
	name: v.pipe(v.string(), v.minLength(1)),
	isActive: v.optional(v.boolean()),
	emoji: v.optional(v.string()),
	name_nl: v.optional(v.string())
});

export const PinChangeSchema = v.object({
	type: v.picklist(['tracker', 'admin']),
	newPin: v.pipe(v.string(), v.minLength(4))
});

export const GoalCreateSchema = v.object({
	personId: v.pipe(v.number(), v.integer()),
	metricId: v.pipe(v.number(), v.integer()),
	target: v.pipe(v.number(), v.integer(), v.minValue(1))
});

export const CountryCreateSchema = v.object({
	personId: v.pipe(v.number(), v.integer()),
	countryCode: v.pipe(v.string(), v.length(2)),
	countryName: v.pipe(v.string(), v.minLength(1))
});
