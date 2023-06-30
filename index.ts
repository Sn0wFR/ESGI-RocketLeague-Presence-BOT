import {config} from "dotenv";

config();

import {
    Client,
    Collection,
    GuildMember,
    Intents,
    MessageAttachment,
    MessageReaction,
    PartialMessageReaction, PartialUser, TextChannel,
    User,
    VoiceChannel,
    VoiceState
} from 'discord.js';
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]});
const token = process.env.TOKEN;
console.log(token);

let msgReactId: string = "";

const minimalTime: number = 30;

let playerPresence: Map<string, number>; // <tag, timestamp>

let total: Map<string, number>; // <tag, totalPresence>

let status: Boolean = false; // true if the bot is currently looking


let cmdList: string[] = ["?help", "?status", "?start", "?stop", "?total", "?clear", "?export", "?inscription", "?adminInscription", "?sendRapport", "?sendOPENrapport"]; // list of commands

let txtChannel = "";
if(process.env.ID_CHANNEL_TXT) {
    txtChannel = process.env.ID_CHANNEL_TXT.toString(); // channel where the bot will send the messages
    console.log(txtChannel);
}

let voiceChannel: string[] = [];
if(process.env.ID_CHANNEL_VOICE) {
    voiceChannel = process.env.ID_CHANNEL_VOICE.split(" "); // channel where the bot will play the music
    console.log(voiceChannel);
}

let inscriptionChannel: string = "";
if(process.env.ID_CHANNEL_INSCRIPTION) {
    inscriptionChannel = process.env.ID_CHANNEL_INSCRIPTION.toString();
}

let rapportChannel: string = "";
if(process.env.ID_CHANNEL_RAPPORT) {
    rapportChannel = process.env.ID_CHANNEL_RAPPORT.toString();
}

let logRapportChannel: string = "";
if(process.env.ID_CHANNEL_LOG_RAPPORT) {
    logRapportChannel = process.env.ID_CHANNEL_LOG_RAPPORT.toString();
}

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
            if (newState.channelId && voiceChannel.includes(newState.channelId) && newState.member) {
                startUserCount(newState);
            } else if (oldState.channelId && voiceChannel.includes(oldState.channelId) && oldState.member) {
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
        voiceChannel.forEach((channel) => {
            let voiceChat = null;
            if(message && message.guild) {
                voiceChat = message.guild.channels.cache.get(channel!);
            }
            if (voiceChat) {
                let members = voiceChat.members as Collection<string, GuildMember>;
                if (members.size > 0) {
                    for (let member of members.values()) {
                        playerPresence.set(member.user.tag, new Date().getTime());
                        console.log("added " + member.user.tag);

                    }
                }
            }
        })

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

        voiceChannel.forEach((channel) => {
            let voiceChat = null;
            if(message && message.guild) {
                voiceChat = message.guild.channels.cache.get(channel!);
            }
            if (voiceChat) {
                let members = voiceChat.members as Collection<string, GuildMember>;
                if (members.size > 0) {
                    for (let member of members.values()) {
                        if (playerPresence.has(member.user.tag)) {
                            let v: number = new Date().getTime() - playerPresence.get(member.user.tag)!;
                            let k = member.user.tag;
                            let res: number = v;
                            if(total && total.get(k) !== undefined){
                                res = res + total.get(k)!;
                            }
                            v = 0;
                            total.set(k, res);
                            playerPresence.set(k, new Date().getTime());
                        }
                    }
                }
            }
        })




        /*


        playerPresence.forEach((v, k, map) => {
            let res: number = v;
            if(total && total.get(k) !== undefined){
                res = res + total.get(k)!;
            }
            v = 0;
            total.set(k, res);
        })*/

        message.channel.send('Bot is not looking anymore');
    }
})


function loadSave(){

        for (let [key, value] of saveTotal) {
            total.set(key, value);
        }
        console.log("total loaded");
        console.log(total);
        saveTotal.clear();
}




client.on("messageReactionAdd", async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    let msg = reaction.message;
    if (msg.id === msgReactId) {
        if (reaction.emoji.name === "✅" && reaction.count && reaction.count > 1) {
            loadSave();
            await msg.delete().then(r => {});
            msg.channel.send("Chargment effectuer");
        }else if(reaction.emoji.name === "❎" && reaction.count && reaction.count > 1){
            await msg.delete().then(r => {});
        }
    }
})

client.on('messageCreate', async (message) => {
    if (message.content === '?total' && message.channel.id === txtChannel) {
        console.log("get total");
        let totalString = "";
        if (status && playerPresence.size > 0) {
            for (let [key, value] of playerPresence.entries()) {
                if (total.has(key)) {
                    total.set(key, total.get(key)! + (new Date().getTime() - value));
                } else {
                    total.set(key, new Date().getTime() - value);
                }
                playerPresence.set(key, new Date().getTime());
            }
        }

        if (total.size === 0) {
            message.channel.send("Le total est vide");
            console.log("save total");
            console.log(saveTotal);
            if (saveTotal.size > 0) {

                await message.channel.send("Voulez vous charger la dernière sauvegarde ?").then((value) => {
                    msgReactId = value.id;
                    value.react('✅');
                    value.react('❎');
                });

                console.log(msgReactId);


                /*TODO message qui demande si l'on veut charger la save
                * repondre par des reaction a ce message
                * sauvegarder l'id du message
                * si l'id correspon on check la reaction
                * puis on agit
                */


            } else {
                message.channel.send("Pas de sauvegarde trouvée");
            }
        }
        total.forEach((value, key) => {
            let hours = Math.floor(value / 3600000);
            let minutes = Math.floor((value % 3600000) / 60000);
            let seconds = Math.floor(((value % 360000) % 60000) / 1000);
            totalString += key + " : " + hours + "h " + minutes + "m " + seconds + "s\n";
        });
        if (totalString !== "") {
            message.channel.send(totalString);
        }
    }
})

function clearing(){
    console.log("clear");
    playerPresence.clear();
    for (let [key, value] of total) {
        saveTotal.set(key, value);
    }
    console.log("save total");
    console.log(saveTotal);
    total.clear();
}

client.on('messageCreate', (message) => {
    if(message.content === '?clear' && message.channel.id === txtChannel){
        clearing();

    }
})

client.on('messageCreate', (message) => {
    if(message.content === '?help' && message.channel.id === txtChannel){
        console.log("help");
        message.channel.send("?start: démarre la recherche de joueurs\n?stop: arrête la recherche de joueurs\n?status: affiche le status de la recherche\n?total: affiche le total de présence de tous les joueurs\n?clear: supprime toutes les données\n?help: affiche ce message");
    }
})

client.on('messageCreate', (message) => {

    if(message.content.startsWith("?") && !cmdList.includes(message.content) && message.channel.id === txtChannel && !message.author.bot){
        message.channel.send("Commande inconnue !\n?start: démarre la recherche de joueurs\n?stop: arrête la recherche de joueurs\n?status: affiche le status de la recherche\n?total: affiche le total de présence de tous les joueurs\n?clear: supprime toutes les données\n?help: affiche ce message");
    }
})

client.on('messageCreate', async (message) => {
    if (message.content === '?export' && !status && message.channel.id === txtChannel) {
        message.channel.send("OK !");
        let sheetData = await authorize().then(getData).catch(console.error);

        let infoRow = sheetData[0];

        let rowCount: number = 0;

        infoRow.forEach((value: any) => {
            rowCount = rowCount + 1;
        })

        let dayDate = new Date();
        let day = dayDate.getDate();
        let month = dayDate.getMonth() + 1;
        let dateValue = "";
        if(day < 10){
            dateValue = "0" + day;
        }else{
            dateValue = "" + day;
        }

        if(month < 10){
            dateValue = dateValue + "/0" + month;
        }else{
            dateValue = dateValue + "/" + month;
        }

        infoRow[rowCount] = dateValue;

        total.forEach((value, key) => {
            sheetData.forEach((row: any) => {
                if(row[0] === key){
                    console.log("entered");
                    let calc: number = 0
                    let actual: string = row[6];
                    let aDay = actual.substring(0, actual.indexOf("j"));
                    calc = calc + (parseInt(aDay) * 24 * 60 * 60 * 1000);

                    let aHour = actual.substring(actual.indexOf("j")+2, actual.indexOf("h"));
                    calc = calc + (parseInt(aHour) * 60 * 60 * 1000);

                    let aMinute = actual.substring(actual.indexOf("h")+2, actual.indexOf("m"));
                    calc = calc + (parseInt(aMinute) * 60 * 1000);

                    let aSecond = actual.substring(actual.indexOf("m")+2, actual.indexOf("s"));
                    calc = calc + (parseInt(aSecond) * 1000);

                    let ms = calc + value;
                    let days = Math.floor(ms / (24*60*60*1000));
                    let daysms = ms % (24*60*60*1000);
                    let hours = Math.floor(daysms / (60*60*1000));
                    let hoursms = ms % (60*60*1000);
                    let minutes = Math.floor(hoursms / (60*1000));
                    let minutesms = ms % (60*1000);
                    let sec = Math.floor(minutesms / 1000);
                    row[6] = days + "j " + hours + "h " + minutes + "m " + sec + "s";

                    let msV = value;
                    let daysV = Math.floor(msV / (24*60*60*1000));
                    let daysmsV = msV % (24*60*60*1000);
                    let hoursV = Math.floor(daysmsV / (60*60*1000));
                    let hoursmsV = msV % (60*60*1000);
                    let minutesV = Math.floor(hoursmsV / (60*1000));
                    let minutesmsV = msV % (60*1000);
                    let secV = Math.floor(minutesmsV / 1000);


                    if (hoursV > 0 || minutesV >= minimalTime){
                        row[7] = parseInt(row[7]) + 1;
                    }
                    row.push(hoursV + "h " + minutesV + "m " + secV + "s");

                }
            })
        })

        sheetData.forEach((row: any) => {
            if (!row[rowCount]){
                row.push("X");
            }
        })

        dataValue = sheetData;

        authorize().then(sendData);

        clearing();
    }
})

client.on('messageCreate', async (message) => {
    if ((message.content.startsWith('?inscription') || (message.content.startsWith('?adminInscription') && message.member?.user.tag === "Sn0w#7505")) && message.channel.id === inscriptionChannel) {
        let member = message.member;
        let msg = message.content;
        let list = msg.split(' ');
        let discordName: string | undefined = "";
        let name = "";
        let lastName = "";
        let classe = "";
        let mail = "";
        let userName = "";
        let data = await authorize().then(getData).catch(console.error);
        let check = true;

        if(message.content.startsWith('?inscription')) {
            if (msg.split(' ').length === 6) {
                discordName = message.member?.user.tag;
                name = list[1];
                lastName = list[2];
                classe = list[3];
                mail = list[4];
                if (!mail.includes("@")) {
                    message.channel.send("<@" + message.member?.id + "> Vous devez indiquer votre prenom nom classe mail_myges et pseudo RL. (ex: ?inscription Mathieu Ferreira 4AL mferreira30@myges.fr Sn0wFR) ");
                    return;
                }
                userName = list[5];
                data.forEach((row: any) => {
                    if (row[0] === discordName) {
                        check = false;
                        return;
                    }
                })
            } else {
                message.channel.send("<@" + message.member?.id + "> Vous devez indiquer votre prenom nom classe mail_myges et pseudo RL. (ex: ?inscription Mathieu Ferreira 4AL mferreira30@myges.fr Sn0wFR) ");
                return;
            }
        }else if(message.content.startsWith('?adminInscription')){
            if (msg.split(' ').length === 7) {
                discordName = list[1];
                // get all member
                let members = await message.guild?.members.fetch();
                let memberFind = members?.find((member) => member.user.tag === discordName);

                if(!memberFind){
                    message.channel.send("L'utilisateur n'existe pas !");
                    return;
                }else{
                    member = memberFind;
                }
                name = list[2];
                lastName = list[3];
                classe = list[4];
                mail = list[5];
                userName = list[6];
                data.forEach((row: any) => {
                    if (row[0] === discordName) {
                        check = false;
                        return;
                    }
                })
            }
        }

        if (!check){
            message.channel.send("<@" + member?.id + "> Vous êtes déjà inscrit, Si vous voyez ce message contacter Sn0w#7505");
            return;
        }

        let value = [discordName, userName, name, lastName, classe, mail, '0j 0h 0m 0s', '0'];

        let rowInfo = data[0];
        let countInfo: number = 0;
        rowInfo.forEach((info: any) => {
            countInfo = countInfo + 1;
        });

        for (let i = 8; i < countInfo; i++) {
            value.push('X');
        }

        data.push(value);

        dataValue = data
        authorize().then(sendData);

        message.channel.send("<@" + member?.id + "> Vous êtes maintenant inscrit");
        let role = message.guild?.roles.cache.find((role) => role.name === "inscrit");
        let role2 = message.guild?.roles.cache.find((role) => role.name === "nouveau");
        if (role && role2 && message.member) {
            await member!.roles.add(role);
            await member!.roles.remove(role2);

        }else{
            message.channel.send("Le role 'inscrit' ou 'nouveau' n'existe pas ou alors le membre à 'disparu' ??????, veuillez contacter Sn0w#7505");
        }

    }
})

client.on("guildMemberAdd", (member) => {
    console.log("add")
    let role = member.guild.roles.cache.find(role => role.name === "nouveau");
    if(role){
        console.log("trouver")
        member.roles.add(role);
    }
    console.log("fin")
})

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('?sendRapport') && message.channel.id === rapportChannel) {
        let debugChannel = message.guild?.channels.cache.find((channel) => channel.id === logRapportChannel) as TextChannel;
        await debugChannel.send("-" + message.member?.user.tag + "- Rapport en cours de traitement");
        let data = await authorize().then(getData).catch(console.error);
        await debugChannel.send("-" + message.member?.user.tag + "- Data récupéré");
        let msg = "";
        data.forEach((row: any) => {
            if (row[0] === message.member?.user.tag) {
                let pointToRemove = 0
                for (let i = 8; i < 29; i++) { // remove point before second semester so we still get bonus point
                    if (row[i] != 'X') {
                        console.log(row[i]);
                        pointToRemove = pointToRemove + 1; //participation before second semester
                    }
                }
                let totalPoint = parseInt(row[7]) - pointToRemove;
                msg = msg + "PseudoRL : " + row[1] + "\nPrenom : " + row[2] + "\nNom : " + row[3] + "\nClasse : " + row[4] + "\nMail MyGES : " + row[5] + "\nTemps de jeu : " + row[6] + "\nPoint : " + totalPoint + "\n";
            }
        })
        await debugChannel.send("-" + message.member?.user.tag + "- Message créer");
        if(msg === ""){
            await message.member?.send("Un problème est survenu, veuillez contacter Sn0w#7505\n Si vous avez récement changer votre tag discord, signalé(e) le moi :) ").catch(console.error);
            await debugChannel.send("-" + message.member?.user.tag + "- Message envoyé (erreur)");
            return;
        }else {
            await message.member?.send(msg).catch(console.error);
            await debugChannel.send("-" + message.member?.user.tag + "- Message envoyé");
        }
    }else if (message.content.startsWith('?sendOPENrapport') && message.channel.id === txtChannel){

        console.log("sendOPENrapport");
        

        //get lastname[2], name[3], classe[4], point[7] and export it in csvFile
        let data = await authorize().then(getData).catch(console.error);

        console.log("get data");
        
        let msg1I = "Nom;Prenom;Classe;Point";
        let msgOther = "Nom;Prenom;Classe;Point";


        data.forEach((row: string) => {

            if(!row[4].startsWith('1PPA')){
                let pointToRemove = 0
                for (let i = 8; i < 29; i++) { // remove point before second semester so we still get bonus point
                    if (row[i] != 'X') {
                        let l = row[i]
                        console.log("la ligne =:" + l)
                        if (l == undefined){
                            continue;
                        }
                        let lh = l.substring(0, l.indexOf('h')+1);
                        console.log("lh: " + lh)
                        let lm = l.substring(l.indexOf('h')+2, l.indexOf('m')+1);
                        console.log("lm: " + lm)

                        if (lh.length == 2) {
                            if (parseInt(lh.substring(0, 1)) == 0) {
                                if (lm.length == 2) {
                                    console.log("skipped 1 ");
                                    continue;
                                } else {
                                    if (parseInt(lm.substring(0, 2)) < 30) {
                                        console.log("skipped 2 ");

                                        continue;
                                    }
                                }
                            }
                        }
                        console.log(row[i]);
                        pointToRemove = pointToRemove + 1; //participation before second semester
                    }
                }
                let totalPoint = parseInt(row[7]) - pointToRemove;

                if (row[4].startsWith("1i") || row[4].startsWith("1I") || row[4].startsWith("1ESGI") || row[4].startsWith("2i") || row[4].startsWith("2I")) {
                    msg1I = msg1I + "\n" + row[3] + ";" + row[2] + ";" + row[4] + ";" + totalPoint;
                }else{
                    msgOther = msgOther + "\n" + row[3] + ";" + row[2] + ";" + row[4] + ";" + totalPoint;
                }
            }

            
        });

        console.log("created msg");

        let file1I = new MessageAttachment(Buffer.from(msg1I), "RapportRocketLeague1I2I.csv");
        let fileOther = new MessageAttachment(Buffer.from(msgOther), "RapportRocketLeague.csv");

        console.log("created file");

        await message.channel.send({files: [file1I, fileOther]});

    }
})
