import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const viewers = sqliteTable("viewers", {
  id: text().primaryKey(),
  name: text().notNull(),
  updated: integer().notNull(),
});

export const plays = sqliteTable("plays", {
  viewer: text().notNull().references(() => viewers.id),
  lesson: text().notNull(),
  start: real().notNull(),
  stop: real().notNull(),
}, (t) => [primaryKey({ columns: [t.viewer, t.lesson, t.start] })]);
