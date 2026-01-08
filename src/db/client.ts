import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import AESService from '../aes-service.js';

import {
  majors,
  students,
  verificationCodes,
  modules,
  type InsertStudent,
  type SelectStudent,
  exams,
} from './schema/index.js';
import { eq, sql, and, gt, lt, desc, isNull, or, inArray } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { Module } from '../sim-document.js';
import type { Enrolement } from '../schemas.js';

import * as schema from './schema/index.js';

const aesKey = process.env.AES_KEY;

if (!aesKey) {
  const generatedKey = await AESService.generateKey();
  console.log(
    'Please provide a valid aes key as an environment variable. A new key is provided below: \n' +
      generatedKey
  );
  process.exit(0);
}

const aesService = await AESService.create(process.env.AES_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle({ client: pool, schema });

const codeLifetimeMs = process.env.VERIFICATION_CODE_LIFETIME_MS ?? 60_000;

function generateSixDigitCode(): string {
  const [randomNumber] = crypto.getRandomValues(new Uint32Array(1));

  const codeNumber = randomNumber! % 1_000_000;
  const code = String(codeNumber).padStart(6, '0');

  return code;
}

export async function createStudent(createStudentData: InsertStudent) {
  const encryptedUsername = await aesService.encrypt(
    createStudentData.username
  );
  const encryptedPassword = await aesService.encrypt(
    createStudentData.password
  );

  return db
    .insert(students)
    .values({
      ...createStudentData,
      ...{ username: encryptedUsername, password: encryptedPassword },
    })
    .returning();
}

export async function createVerificationCode(studentId: string) {
  const code = generateSixDigitCode();

  const [createdCode] = await db
    .insert(verificationCodes)
    .values({
      code,
      expiresAt: sql`now() + ${codeLifetimeMs} * interval '1 millisecond'`,
      studentId,
    })
    .returning();

  return createdCode;
}

export async function redeemVerificationCode(
  studentId: string,
  code: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [redeemableVerificationCode] = await tx
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.studentId, studentId),
          gt(verificationCodes.expiresAt, sql`now()`),
          isNull(verificationCodes.usedAt)
        )
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1)
      .for('no key update');

    if (!redeemableVerificationCode) throw new Error(`No active code found`);

    if (redeemableVerificationCode.code !== code)
      throw new Error(`Invalid code`);

    await tx
      .update(verificationCodes)
      .set({ usedAt: sql`now()` })
      .where(eq(verificationCodes.id, redeemableVerificationCode.id));
    await tx
      .update(students)
      .set({ isVerified: true })
      .where(eq(students.id, studentId));
  });
}

export async function claimOutdatedStudents(
  batchSize: number,
  olderThanMs: number,
  claimDurationMs: number
): Promise<SelectStudent[]> {
  return db.transaction(async (tx) => {
    const outdatedStudents = await tx
      .select()
      .from(students)
      .where(
        and(
          or(
            isNull(students.fetchedAt),
            lt(
              students.fetchedAt,
              sql`now() - ${olderThanMs} * interval '1 millisecond'`
            )
          ),
          or(
            isNull(students.claimedAt),
            lt(students.claimedAt, students.fetchedAt),
            lt(
              students.claimedAt,
              sql`now() - ${claimDurationMs} * interval '1 millisecond'`
            )
          )
        )
      )
      .orderBy(sql`${students.fetchedAt} ASC NULLS FIRST`)
      .limit(batchSize)
      .for('no key update', { skipLocked: true });

    if (outdatedStudents.length === 0) return [];

    const studentIds = outdatedStudents.map((s) => s.id);
    const finalStudents = await tx
      .update(students)
      .set({ claimedAt: sql`now()` })
      .where(inArray(students.id, studentIds))
      .returning();

    return Promise.all(
      finalStudents.map(async (s) => {
        const decryptedUsername = await aesService.decrypt(s.username);
        const decryptedPassword = await aesService.decrypt(s.password);

        return {
          ...s,
          ...{ username: decryptedUsername, password: decryptedPassword },
        };
      })
    );
  });
}

export async function deltaExists(
  student: SelectStudent,
  enrolement: Enrolement,
  mods: Module[],
  provisionalGrade: number
) {
  const major = await db
    .selectDistinct()
    .from(majors)
    .where(eq(majors.id, enrolement.majorId));

  if (!major) return true;

  const moduleIds = mods.map((m) => m.id);

  const foundModules = await db.query.modules.findMany({
    where: (module, { and, eq }) =>
      and(
        eq(module.majorId, enrolement.majorId)
      ),
    with: {
      exams: true,
    },
  });

  foundModules[0]!.exams.
}

export async function updateGrades(
  modules: Module[],
  provisionalGrade: number
) {}
