import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import AESService from '../aes-service.js';

import {
  students,
  verificationCodes,
  type InsertStudent,
} from './schema/index.js';
import { eq, sql, and, gt, desc, isNull, SQL } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';

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

const db = drizzle({ client: pool });

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
    }).returning();
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

export async function getStudentsToUpdate(olderThanMs: number, tx?: PgTransaction<any, any, any>) {
  const executor = tx ?? db;

  
}
