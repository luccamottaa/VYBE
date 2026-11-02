import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const chartSnapshots = sqliteTable('chart_snapshots', {
  country: text('country').notNull(), date: text('date').notNull(),
  fetched: integer('fetched').notNull(), updated: text('updated').notNull(), payload: text('payload').notNull(),
}, table => [primaryKey({columns:[table.country,table.date]})]);

export const spotifySnapshots = sqliteTable('spotify_snapshots', {
  chart: text('chart').notNull(), date: text('date').notNull(),
  fetched: integer('fetched').notNull(), source: text('source').notNull(), payload: text('payload').notNull(),
}, table => [primaryKey({columns:[table.chart,table.date]})]);
