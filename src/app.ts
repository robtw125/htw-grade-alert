import 'dotenv/config';
import PushoverClient from "./pushover-client.js";
import { createVerificationCode, redeemVerificationCode } from './db/client.js';

const client = new PushoverClient('https://api.pushover.net/1/', process.env.PUSHOVER_API_KEY);

console.log('c')

const verificationCode = await createVerificationCode('fc32238a-b031-46c3-8456-73c13e847c1a');

console.log('cf')

if(!verificationCode)
  process.exit(1);

//await client.pushMessage({ userKey: 'u9rsggxwac9p72zqm546p3rauzuv19' }, { title: 'Bestätigungscode', content: `Dein Bestätigungscode lautet ${verificationCode.code}` })

console.log('redeeming');

await redeemVerificationCode('fc32238a-b031-46c3-8456-73c13e847c1a', verificationCode.code);

console.log('redeemed');

