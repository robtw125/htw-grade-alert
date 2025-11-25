import 'dotenv/config.js';
import SimClient from './sim-client.js';

const client = new SimClient('https://sim.htwsaar.de', { username: process.env.HTW_USERNAME, password: process.env.HTW_PASSWORD });
await client.authenticate();
console.log(await client.fetchPdf());