import 'dotenv/config';
import { claimOutdatedStudents } from './db/client.js';
import type { SelectStudent } from './db/schema/index.js';
import SIMClient from './sim-client.js';
import SIMDocument from './sim-document.js';

const BATCH_SIZE = 10;
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const CLAIM_DURATION = 3 * 60 * 1000;

async function updateStudent(student: SelectStudent) {
  const client = new SIMClient('https://sim.htwsaar.de/launchpad', {
    username: student.username,
    password: student.password,
  });

  await client.authenticate();
  const enrolements = await client.fetchEnrolements();
  
  for(const enrolement of enrolements) {
    const pdfData = await client.fetchPdf(enrolement);
    const pdf = await SIMDocument.fromBase64(pdfData);

    const modules = await pdf.extractModules();
    console.log(enrolement, modules);
  }
}

async function startUpdateLoop() {
  while (true) {
    const studentsToUpdate = await claimOutdatedStudents(BATCH_SIZE, UPDATE_INTERVAL_MS, CLAIM_DURATION);

    for(const student of studentsToUpdate) {
      await updateStudent(student);
    }

    await (new Promise(res => setTimeout(res, 2500)));
  }
}

startUpdateLoop();
