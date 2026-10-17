import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1)});
