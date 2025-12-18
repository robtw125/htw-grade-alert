import { pgTable, uuid, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentNumber: integer().notNull().unique(),
  username: varchar('username').notNull(),
  password: varchar('password').notNull(),
  fetchedAt: timestamp('fetched_at'),
  areCredentialsValid: boolean('are_credentials_valid').default(true),
  pushoverUserKey: varchar('pushover_user_key', { length: 64 }).notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
});

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 6 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at').notNull(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade'}),
});

export const studentsRelations = relations(students, ({ many }) => ({
  verificationCodes: many(verificationCodes)
}));

export const verificationCodesRelations = relations(verificationCodes, ({ one }) => ({
  student: one(students, {
    fields: [verificationCodes.studentId],
    references: [students.id],
  }),
}));