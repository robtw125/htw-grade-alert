import 'dotenv/config';

import * as p from '@clack/prompts';
import SIMClient from './sim-client.js';
import { createStudent, createVerificationCode, redeemVerificationCode } from './db/client.js';
import PushoverClient from './pushover-client.js';
import type { SelectStudent } from './db/schema/index.js';

const pushoverClient = new PushoverClient('https://api.pushover.net/1/', process.env.PUSHOVER_API_KEY);

async function showAddStudentDialog() {
  const credentials = await p.group({
    username: () => p.text({ message: 'HTW-Kennung:' }),
    password: () => p.password({ message: 'HTW-Passwort:' }),
  });

  const s = p.spinner();
  s.start('Prüfe Anmeldedaten...');

  const client = new SIMClient('https://sim.htwsaar.de/launchpad', credentials);

  try {
    await client.authenticate();
  } catch (e) {
    s.stop('Anmeldedaten erfolgreich geprüft.');

    let message =
      'Ein Fehler ist aufgetreten, bitte versuche es später erneut!';

    if (e instanceof Error) message = e.message;

    p.log.error(message);
    p.cancel();
    
    return;
  }

  s.stop('Anmeldung erfolgreich');

  const enrolements = await client.fetchEnrolements();

  if(!enrolements || enrolements.length === 0) {
    p.log.error('Der angegebene Benutzer ist nicht eingeschrieben!');
    p.cancel();
  } 

  const studentNumber = enrolements[0]!.studentNumber;

  p.log.info(`Deine Matrikelnummer lautet: ${studentNumber}`);

  const pushoverInput = await p.text({ message: 'Nutzerschlüssel (Pushover):'});

  if (p.isCancel(pushoverInput)) {
    p.cancel('Vorgang abgebrochen.');
    process.exit(0);
}

  s.start('Speichere Nutzer in der Datenbank');


  try {
    const student = await createStudent({ username: credentials.username, password: credentials.password, studentNumber, pushoverUserKey: pushoverInput });
    s.stop('Nutzer gespeichert');
    await showVerificationDialog(student[0]!);
  } catch(e) {
    let message = 'Ein unbekannter Fehler ist aufgetreten';

    if(e instanceof Error) {
      message = e.message;
    }

    s.stop('Fehler beim Speichern');
    p.log.error(message);
    p.cancel();
  }
}

async function showVerificationDialog(student: SelectStudent) {
  const verificationCode = await createVerificationCode(student.id);

  if(!verificationCode) {
    p.log.error('Es konnte kein Bestätigungscode generiert werden.');
    p.cancel();
    return;
  }

  const recipient = {
    userKey: student.pushoverUserKey,
  }

  pushoverClient.pushMessage(recipient, { title: 'Dein Bestätigungscode', content: `Dein Bestätigungscode lautet ${verificationCode.code}`});

  const enteredCode = await p.text({ message: 'Bestätigungscode' });
  
  if(enteredCode != verificationCode.code || p.isCancel(enteredCode)) {
    p.log.error('Ungültiger Bestätigungscode.');
    p.cancel();
  }

  await redeemVerificationCode(student.id, String(enteredCode));
  p.log.success('Account erfolgreich bestätigt!');
}

showAddStudentDialog();
