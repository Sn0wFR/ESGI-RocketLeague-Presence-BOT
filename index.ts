import {config} from "dotenv";
import {Client, Intents, User, VoiceState} from 'discord.js';

config();

import {Client, Collection, GuildMember, Intents, User, VoiceChannel, VoiceState} from 'discord.js';
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const token = process.env.TOKEN;

let playerPresence: Map<string, number>; // <tag, timestamp>

let total: Map<string, number>; // <tag, totalPresence>

let status: Boolean = false; // true if the bot is currently looking


let cmdList: string[] = ["?help", "?status", "?start", "?stop", "?total", "?clear", "?export"]; // list of commands

let txtChannel: string = process.env.ID_CHANNEL_TXT!.toString(); // channel where the bot will send the messages

let voiceChannel: string = process.env.ID_CHANNEL_VOICE!.toString(); // channel where the bot will play the music

let saveTotal: Map<string, number>; // <tag, totalPresence>

let dataValue: String[][];


const fs = require('fs').promises;
const path = require('path');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
//const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials_sheets.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'myCred.json');


/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client: any) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}


async function getData(auth: any) {
    const sheets = google.sheets({version: 'v4', auth});

    const res = await sheets.spreadsheets.values.get({
        //spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        spreadsheetId: "1xQmaZz-QlSN9vSMBAE_o5PTvCG5FoFmTcAKA_PmxMgs",
        range: 'Sheet1',
    });
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return;
    }
    return rows;
}

async function sendData(auth: any) {
    const sheets = google.sheets({version: 'v4', auth});

    const body = {
        values: dataValue,
    };

    try {
        sheets.spreadsheets.values.update({
            spreadsheetId: "1xQmaZz-QlSN9vSMBAE_o5PTvCG5FoFmTcAKA_PmxMgs",
            range: 'Sheet1',
            valueInputOption: 'RAW',
            resource: body
        }).then((response: any) => {
            const result = response.data;
            console.log(`${result.updatedCells} cells updated.`);
            dataValue.splice(0);
        });
    } catch (err) {
        console.log(err);
        return;
    }

}

client.once('ready', () => {
    console.log('Ready!');
    playerPresence = new Map<string, number>();
    total = new Map<string, number>();
    saveTotal = new Map<string, number>();
});

client.login(token).then(r => {});



client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
    if(status) {
        if (newState) {
            if (newState.channelId && newState.channelId === voiceChannel && newState.member) {
                startUserCount(newState);
            } else if (oldState.channelId && oldState.channelId === voiceChannel && oldState.member) {
                endUserCount(oldState);
            }
        }
    }
})

function startUserCount(newState: any) {
    let member: User = newState.member.user;
    console.log(member.tag);
    if (!playerPresence.has(member.tag)) {
        playerPresence.set(member.tag, new Date().getTime());
        console.log("added " + member.tag);
    }
}

function endUserCount(oldState: any) {
    let member: User = oldState.member.user;
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
            } else {
                total.set(member.tag, timeDiff);
                console.log("added new " + member.tag + " " + timeDiff);
                playerPresence.delete(member.tag);
            }
        }
    }
}

client.on('messageCreate', (message) => {
    if(message.content === '?status' && message.channel.id === txtChannel) {
        console.log("status");
        if (status) {
            message.channel.send('Bot is currently looking');
        }else{
            message.channel.send('Bot is not looking');
        }
    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?start' && message.channel.id === txtChannel) {
        if (status) {
            message.channel.send('Bot is already looking');
            return;
        }
        console.log("start");
        status = true;
        let voiceChat = null;
        if(message && message.guild) {
            voiceChat = message.guild.channels.cache.get(voiceChannel);
        }
        if (voiceChat) {
            let members = voiceChat.members as Collection<string, GuildMember>;
            if (members.size > 0) {
                for (let member of members.values()) {
                    if (!playerPresence.has(member.user.tag)) {
                        playerPresence.set(member.user.tag, new Date().getTime());
                        console.log("added " + member.user.tag);
                    }
                }
            }
        }
        message.channel.send('Bot is now looking');
    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?stop' && message.channel.id === txtChannel) {
        if (!status) {
            message.channel.send('Bot is not looking');
            return;
        }
        console.log("stop");
        status = false;
        message.channel.send('Bot is not looking anymore');
    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?total' && message.channel.id === txtChannel) {
        console.log("get total");
        let totalString = "";
        if(status && playerPresence.size > 0) {
            for (let [key, value] of playerPresence.entries()) {
                if(total.has(key)) {
                    total.set(key, total.get(key)! + (new Date().getTime() - value));
                }else{
                    total.set(key, new Date().getTime() - value);
                }
                playerPresence.set(key, new Date().getTime());
            }
        }

        if(total.size === 0) {
            message.channel.send("Le total est vide");
            console.log("save total");
            console.log(saveTotal);
            if(saveTotal.size > 0) {
                message.channel.send("Sauvegarde du dernier total trouvé");
                for (let [key, value] of saveTotal) {
                    total.set(key, value);
                }
                console.log("total loaded");
                console.log(total);
                saveTotal.clear();
            }else{
                message.channel.send("Pas de sauvegarde trouvée");
            }
        }
        total.forEach((value, key) => {
            totalString += key + ": " + value + "\n";
        });
        if (totalString !== "") {
            message.channel.send(totalString);
        }else{
            message.channel.send("Personne n'a encore joué de puis le dernier '!start'\n Les joueurs doivent ce déconnecter du vocal avant de pouvoir avoir une valeur !");
        }
    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?clear' && message.channel.id === txtChannel){
        console.log("clear");
        playerPresence.clear();
        for (let [key, value] of total) {
            saveTotal.set(key, value);
        }
        console.log("save total");
        console.log(saveTotal);
        total.clear();

    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?export' && message.channel.id === txtChannel){
        console.log("export");
        message.channel.send("Export en cours de dev");
        //TODO export

    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?help' && message.channel.id === txtChannel){
        console.log("help");
        message.channel.send("!start: démarre la recherche de joueurs\n!stop: arrête la recherche de joueurs\n!status: affiche le status de la recherche\n!total: affiche le total de présence de tous les joueurs\n!clear: supprime toutes les données\n!help: affiche ce message");
    }
})

client.on('messageCreate', (message) => {

    if(message.content.startsWith("?") && !cmdList.includes(message.content) && message.channel.id === txtChannel && !message.author.bot){
        message.channel.send("Commande inconnue !\n!start: démarre la recherche de joueurs\n!stop: arrête la recherche de joueurs\n!status: affiche le status de la recherche\n!total: affiche le total de présence de tous les joueurs\n!clear: supprime toutes les données\n!help: affiche ce message");
    }

    //Si commande inconnue
})

client.on('messageCreate', async (message) => {
    if (message.content === '!export') {
        message.channel.send("OK !");
        let sheetData = await authorize().then(getData).catch(console.error);

        total.forEach((value, key) => {
            sheetData.forEach((row: any) => {
                if(row[0] === key){
                    console.log("entered");
                    let calc: number = 0
                    let actual: string = row[2];
                    let aDay = actual.substring(0, actual.indexOf("j"));
                    calc = calc + (parseInt(aDay) * 24 * 60 * 60 * 1000);

                    let aHour = actual.substring(actual.indexOf("j")+2, actual.indexOf("h"));
                    calc = calc + (parseInt(aHour) * 60 * 60 * 1000);

                    let aMinute = actual.substring(actual.indexOf("h")+2, actual.indexOf("m"));
                    calc = calc + (parseInt(aMinute) * 60 * 1000);

                    let aSecond = actual.substring(actual.indexOf("m")+2, actual.indexOf("s"));
                    calc = calc + (parseInt(aSecond) * 1000);

                    let ms = calc + value;
                    const days = Math.floor(ms / (24*60*60*1000));
                    const daysms = ms % (24*60*60*1000);
                    const hours = Math.floor(daysms / (60*60*1000));
                    const hoursms = ms % (60*60*1000);
                    const minutes = Math.floor(hoursms / (60*1000));
                    const minutesms = ms % (60*1000);
                    const sec = Math.floor(minutesms / 1000);
                    row[2] = days + "j " + hours + "h " + minutes + "m " + sec + "s";

                }
            })
        })

        dataValue = sheetData;

        authorize().then(sendData);

    }
})

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!inscription')) {
        let msg = message.content;
        if (msg.split(' ').length === 2) {
            let list = msg.split(' ');
            let discordName = message.member?.user.tag;
            let userName = list[1];
            let data = await authorize().then(getData).catch(console.error);
            let check: boolean = true;
            data.forEach((row: any) => {
                if(row[0] === discordName){
                    check = false;
                    return;
                }
            })

            if (!check){
                message.channel.send("<@" + message.member?.id + "> Vous êtes déjà inscrit, Si vous voyez ce message contacter Sn0w#7505");
                return;
            }

            data.push([discordName, userName, '0', '0']);

            dataValue = data
            authorize().then(sendData);

            message.channel.send("<@" + message.member?.id + "> Vous êtes maintenant inscrit");
            setInterval(() => {
                let role = message.guild?.roles.cache.find(role => role.name === "inscrit");
                if (role){
                    message.member?.roles.add(role);
                }else{
                    message.channel.send("Le role 'inscrit' n'existe pas, veuillez contacter Sn0w#7505");
                }
            }, 5000);


        } else {
            message.channel.send("<@" + message.member?.id + "> Vous devez indiquer votre pseudo RL. (ex: !inscription Sn0wFR) ");
        }
    }
})

client.on("guildMemberAdd", (member) => {
    let role = member.guild.roles.cache.find(role => role.name === "nouveau");
    if(role){
        member.roles.add(role);
    }


})