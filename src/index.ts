import 'dotenv/config.js';

import SimClient from './sim-client.js';
import SIMDocument from './sim-document.js';

const client = new SimClient('https://sim.htwsaar.de', { username: process.env.HTW_USERNAME, password: process.env.HTW_PASSWORD });

await client.authenticate();
const base64String = await client.fetchPdf();

console.log('Fetched!')

const pdf = await SIMDocument.fromBase64(base64String);
console.log(await pdf.extractModules());