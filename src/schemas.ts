import * as z from 'zod';

export const studentResponseSchema = z
  .object({
    d: z.object({
      results: z.array(
        z.object({
          Studiengang_ID: z.coerce.number(),
          Studentnumber: z.coerce.number(),
          Studiengaenge: z.string(),
          Sprache: z.string(),
        })
      ),
    }),
  })
  .transform((r) => {
    return r.d.results.map((result) => {
      const studentId = r.d.results[0]!.Studentnumber;
      const majorId = r.d.results[0]!.Studiengang_ID;
      const majorName = r.d.results[0]!.Studiengaenge;
      const language = r.d.results[0]!.Sprache;

      return { studentId, majorId, majorName, language };
    });
  });

export const pdfResponseSchema = z
  .object({
    d: z.object({ Data: z.base64() }),
  })
  .transform((r) => r.d.Data);

export type StudentResponse = z.infer<typeof studentResponseSchema>;