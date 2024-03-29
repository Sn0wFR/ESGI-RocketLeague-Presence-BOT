"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const discord_js_1 = require("discord.js");
const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES, discord_js_1.Intents.FLAGS.GUILD_VOICE_STATES] });
const token = process.env.TOKEN;
let playerPresence; // <tag, timestamp>
let total; // <tag, totalPresence>
let status = false; // true if the bot is currently looking
client.once('ready', () => {
    console.log('Ready!');
    playerPresence = new Map();
    total = new Map();
});
client.login(token).then(r => { });
client.on('voiceStateUpdate', (oldState, newState) => {
    if (status) {
        if (newState) {
            if (newState.channelId && !oldState.channelId && newState.member) {
                let member = newState.member.user;
                console.log(member.tag);
                if (!playerPresence.has(member.tag)) {
                    playerPresence.set(member.tag, new Date().getTime());
                    console.log("added " + member.tag);
                    const channel = client.channels.cache.find(channel => channel.id === "986387607233634326");
                }
            }
            else if (oldState.channelId && !newState.channelId && oldState.member) {
                let member = oldState.member.user;
                if (playerPresence.has(member.tag)) {
                    let playerTime = playerPresence.get(member.tag);
                    if (playerTime) {
                        let timeNow = new Date().getTime();
                        console.log(timeNow);
                        let timeDiff = timeNow - playerTime;
                        if (total.has(member.tag)) {
                            let totalTime = total.get(member.tag);
                            if (totalTime) {
                                total.set(member.tag, totalTime + timeDiff);
                                console.log("added " + member.tag + " " + timeDiff + " | total: " + total.get(member.tag));
                                playerPresence.delete(member.tag);
                            }
                        }
                        else {
                            total.set(member.tag, timeDiff);
                            console.log("added new " + member.tag + " " + timeDiff);
                            playerPresence.delete(member.tag);
                        }
                    }
                }
            }
        }
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!status') {
        console.log("status");
        if (status) {
            message.channel.send('Bot is currently looking');
        }
        else {
            message.channel.send('Bot is not looking');
        }
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!start') {
        if (status) {
            message.channel.send('Bot is already looking');
            return;
        }
        console.log("start");
        status = true;
        message.channel.send('Bot is now looking');
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!stop') {
        if (!status) {
            message.channel.send('Bot is not looking');
            return;
        }
        console.log("stop");
        status = false;
        message.channel.send('Bot is not looking anymore');
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!total') {
        console.log("get total");
        let totalString = "";
        total.forEach((value, key) => {
            totalString += key + ": " + value + "\n";
        });
        if (totalString !== "") {
            message.channel.send(totalString);
        }
        else {
            message.channel.send("Personne n'a encore joué de puis le dernier '!start'\n Les joueurs doivent ce déconnecter du vocal avant de pouvoir avoir une valeur !");
        }
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!clear') {
        console.log("clear");
        playerPresence.clear();
        total.clear(); // voir pour une sauvegarde # TODO
    }
});
client.on('messageCreate', (message) => {
    if (message.content === '!help') {
        console.log("help");
        message.channel.send("!start: démarre la recherche de joueurs\n!stop: arrête la recherche de joueurs\n!status: affiche le status de la recherche\n!total: affiche le total de présence de tous les joueurs\n!clear: supprime toutes les données");
    }
});
client.on('messageCreate', (message) => {
    //Si commande inconnue
});
//# sourceMappingURL=index.js.map