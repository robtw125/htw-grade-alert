import 'dotenv/config';
import SIMClient from './sim-client.js';
import SIMDocument from './document.js'

const client = new SIMClient('https://sim.htwsaar.de/launchpad', {
  username: 'rowa00005',
  password: '$hHHci4Z#@QHJ3F!'
})

await client.authenticate();

const enrolement = await client.fetchEnrolements();
const pdfData = await client.fetchPdf(enrolement[0]!);

const document = await SIMDocument.fromBase64(pdfData);
const modules = await document.parse();

console.log(modules);
