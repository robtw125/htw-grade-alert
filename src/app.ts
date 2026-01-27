import "dotenv/config";
import {
  claimOutdatedStudents,
  getModuleDelta,
  getExamDelta,
  syncStudentData,
} from "./db/client.js";
import type { SelectStudent } from "./db/schema/index.js";
import SIMClient from "./sim-client.js";
import SIMDocument from "./document.js";
import PushoverClient from "./pushover-client.js";

const BATCH_SIZE = 10;
const UPDATE_INTERVAL_MS = process.env.UPDATE_INTERVAL;
const CLAIM_DURATION = process.env.CLAIM_DURATION;

const pushoverClient = new PushoverClient(
  "https://api.pushover.net/1/",
  process.env.PUSHOVER_API_KEY
);

async function updateStudent(student: SelectStudent) {
  const client = new SIMClient("https://sim.htwsaar.de/launchpad", {
    username: student.username,
    password: student.password,
  });

  await client.authenticate();
  const enrolements = await client.fetchEnrolements();

  for (const enrolement of enrolements) {
    const pdfData = await client.fetchPdf(enrolement);
    const pdf = await SIMDocument.fromBase64(pdfData);

    const modules = await pdf.parse();

    const moduleDelta = await getModuleDelta(modules, student.id);
    const examDelta = await getExamDelta(modules, student.id);

    if (moduleDelta.length > 0 || examDelta.length > 0) {
      const message = PushoverClient.generateGradeAlert(moduleDelta, examDelta);
      await pushoverClient.pushMessage(
        { userKey: student.pushoverUserKey },
        message
      );
    }

    await syncStudentData(
      modules,
      student.id,
      enrolement.majorId,
      enrolement.majorName
    );
  }
}

async function startUpdateLoop() {
  while (true) {
    console.log("Starte Aktualisierung...");

    try {
      const studentsToUpdate = await claimOutdatedStudents(
        BATCH_SIZE,
        UPDATE_INTERVAL_MS,
        CLAIM_DURATION
      );

      for (const student of studentsToUpdate) {
        await updateStudent(student);
      }

      console.log("Aktualisierung beendet!");

      await new Promise((res) => setTimeout(res, 60000));
    } catch (e) {
      console.error(e);
    }
  }
}

startUpdateLoop();
