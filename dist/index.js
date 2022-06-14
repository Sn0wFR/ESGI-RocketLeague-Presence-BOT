"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const discord_js_1 = require("discord.js");
const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES] });
const token = process.env.TOKEN;
client.once('ready', () => {
    console.log('Ready!');
});
client.login(token).then(r => { });
//# sourceMappingURL=index.js.map