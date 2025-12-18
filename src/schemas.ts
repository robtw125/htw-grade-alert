import * as z from 'zod';

export const enrolementSchema = z
  .object({
    Studiengang_ID: z.coerce.number(),
    Studentnumber: z.coerce.number(),
    Studiengaenge: z.string(),
    Sprache: z.string(),
  })
  .transform((r) => ({
    studentNumber: r.Studentnumber,
    majorId: r.Studiengang_ID,
    majorName: r.Studiengaenge,
    languageCode: r.Sprache,
  }));

export const enrolementsSchema = z
  .object({
    d: z.object({
      results: z.array(enrolementSchema),
    }),
  })
  .transform(r => r.d.results);

export const pdfResponseSchema = z
  .object({
    d: z.object({ Data: z.base64() }),
  })
  .transform((r) => r.d.Data);

export type Enrolement = z.infer<typeof enrolementSchema>;
export type Enrolements = z.infer<typeof enrolementsSchema>;
