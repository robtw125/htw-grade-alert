import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  unique,
  doublePrecision,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import {
  relations,
  type InferEnum,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';

export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentNumber: integer().notNull().unique(),
  username: varchar('username').notNull(),
  password: varchar('password').notNull(),
  fetchedAt: timestamp('fetched_at'),
  claimedAt: timestamp('claimed_at'),
  areCredentialsValid: boolean('are_credentials_valid').default(true),
  pushoverUserKey: varchar('pushover_user_key', { length: 64 }).notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
});

export const majors = pgTable('majors', {
  id: integer('id').primaryKey(),
  name: varchar('name'),
});

export const modules = pgTable('modules', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  majorId: integer('major_id')
    .notNull()
    .references(() => majors.id, { onDelete: 'cascade' }),
  name: varchar('name'),
  code: integer('code')
}, (t) => [
  unique().on(t.majorId, t.code)
]);

export const moduleStatus = pgEnum('module_status', ['in_progress', 'passed', 'failed']);

export const moduleResults = pgTable(
  'module_results',
  {
    moduleId: integer('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    semester: varchar('semester').notNull(),
    cp: integer('cp').notNull(),
    grade: doublePrecision('grade'),
    status: moduleStatus('passed').notNull(),
  },
  (t) => [primaryKey({ columns: [t.moduleId, t.studentId] })]
);

export const exams = pgTable(
  'exams',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    moduleId: integer('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    name: varchar('name').notNull(),
  },
  (t) => [unique().on(t.moduleId, t.name)]
);

export const examResults = pgTable(
  'exam_results',
  {
    examId: integer('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    percentage: integer('percentage'),
    passed: boolean().notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.studentId] })]
);

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 6 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at').notNull(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
});

export const majorsRelations = relations(majors, ({ many }) => ({
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  major: one(majors, {
    fields: [modules.majorId],
    references: [majors.id],
  }),
  exams: many(exams),
  results: many(moduleResults),
}));

export const moduleResultsRelations = relations(moduleResults, ({ one }) => ({
  module: one(modules, {
    fields: [moduleResults.moduleId],
    references: [modules.id],
  }),
  student: one(students, {
    fields: [moduleResults.studentId],
    references: [students.id],
  }),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  module: one(modules, {
    fields: [exams.moduleId],
    references: [modules.id],
  }),
  results: many(examResults),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  exam: one(exams, {
    fields: [examResults.examId],
    references: [exams.id],
  }),
  student: one(students, {
    fields: [examResults.studentId],
    references: [students.id],
  }),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  verificationCodes: many(verificationCodes),
  moduleResults: many(moduleResults),
  examResults: many(examResults),
}));

export const verificationCodesRelations = relations(
  verificationCodes,
  ({ one }) => ({
    student: one(students, {
      fields: [verificationCodes.studentId],
      references: [students.id],
    }),
  })
);

export type InsertStudent = InferInsertModel<typeof students>;
export type SelectStudent = InferSelectModel<typeof students>;
export type ModuleStatus = InferEnum<typeof moduleStatus>;
