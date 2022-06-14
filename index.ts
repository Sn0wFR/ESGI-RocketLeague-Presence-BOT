import {config} from "dotenv";

config();

import { Client, Intents } from 'discord.js';
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const token = process.env.TOKEN;

client.once('ready', () => {
    console.log('Ready!');
});

client.login(token).then(r => {});

