"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const discord_js_1 = require("discord.js");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.Intents.FLAGS.GUILDS,
        discord_js_1.Intents.FLAGS.GUILD_MESSAGES,
        discord_js_1.Intents.FLAGS.GUILD_VOICE_STATES,
        discord_js_1.Intents.FLAGS.GUILD_MEMBERS,
        discord_js_1.Intents.FLAGS.GUILD_MESSAGES,
        discord_js_1.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ]
});
const token = process.env.TOKEN;
if (!token) {
    throw new Error("TOKEN manquant dans les variables d'environnement");
}
const fs_1 = __importDefault(require("fs"));
const cmdList = [
    "?help",
    "?status",
    "?start",
    "?stop",
    "?total",
    "?clear",
    "?export",
    "?inscription",
    "?adminInscription",
    "?sendRapport",
    "?sendOPENrapport",
]; // list of commands
/**
 * Saves all player data to a JSON file.
 *
 * Serializes the provided player data map into an array and writes it to the specified file path in JSON format.
 */
function savePlayersToFile(playersInfo, filePath) {
    const players = Array.from(playersInfo.values());
    const tmp = `${filePath}.tmp`;
    try {
        fs_1.default.writeFileSync(tmp, JSON.stringify(players, null, 2), "utf8");
        fs_1.default.renameSync(tmp, filePath);
    }
    catch (err) {
        try {
            if (fs_1.default.existsSync(tmp))
                fs_1.default.unlinkSync(tmp);
        }
        catch { /* empty */ }
        console.error("Erreur de sauvegarde data.json:", err);
    }
}
/**
 * Loads player data from a JSON file and returns it as an array of PlayerData objects.
 *
 * @param filePath - The path to the JSON file containing player data
 * @returns An array of PlayerData objects parsed from the file
 */
function loadPlayersFromFile(filePath) {
    try {
        if (!fs_1.default.existsSync(filePath))
            return [];
        const data = fs_1.default.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (err) {
        console.error("Lecture data.json échouée, fallback []:", err);
        return [];
    }
}
let playersFromFile = loadPlayersFromFile("./data.json");
let playersInfo = new Map();
playersFromFile.forEach((player) => {
    playersInfo.set(player.discord, player);
});
let msgReactId = "";
const minimalTime = 1;
const playerPresence = new Map(); // <id, timestamp>
const total = new Map(); // <id, totalPresence>
const saveTotal = new Map(); // <id, totalPresence>
let status = false; // true if the bot is currently looking
let txtChannel = "";
if (process.env.ID_CHANNEL_TXT) {
    txtChannel = process.env.ID_CHANNEL_TXT.toString(); // channel where the bot will send the messages
    console.log(txtChannel);
}
let voiceChannel = [];
if (process.env.ID_CHANNEL_VOICE) {
    voiceChannel = process.env.ID_CHANNEL_VOICE.split(" "); // channel where the bot will play the music
    console.log("voiceChannel: " + voiceChannel);
}
let inscriptionChannel = "";
if (process.env.ID_CHANNEL_INSCRIPTION) {
    inscriptionChannel = process.env.ID_CHANNEL_INSCRIPTION.toString();
}
let rapportChannel = "";
if (process.env.ID_CHANNEL_RAPPORT) {
    rapportChannel = process.env.ID_CHANNEL_RAPPORT.toString();
}
let logRapportChannel = "";
if (process.env.ID_CHANNEL_LOG_RAPPORT) {
    logRapportChannel = process.env.ID_CHANNEL_LOG_RAPPORT.toString();
}
client.once("ready", () => {
    console.log("Ready!");
});
client.login(token).then(_r => { });
client.on("voiceStateUpdate", (oldState, newState) => {
    if (status) {
        if (newState) {
            if (newState.channelId &&
                voiceChannel.includes(newState.channelId) &&
                newState.member) {
                startUserCount(newState);
            }
            else if (oldState.channelId &&
                voiceChannel.includes(oldState.channelId) &&
                oldState.member) {
                endUserCount(oldState);
            }
        }
    }
});
/**
 * Begins tracking the presence time for a user when they join a monitored voice channel.
 *
 * Adds the user's ID and the current timestamp to the presence tracking map if not already present.
 */
function startUserCount(newState) {
    let member = newState.member.user;
    if (!playerPresence.has(member.id)) {
        playerPresence.set(member.id, new Date().getTime());
        console.log("added " + member.id);
    }
}
/**
 * Updates and records the total presence time for a user when they leave a tracked voice channel.
 *
 * If the user was being tracked, calculates the duration of their session and adds it to their total presence time.
 */
function endUserCount(oldState) {
    let member = oldState.member.user;
    if (playerPresence.has(member.id)) {
        let playerTime = playerPresence.get(member.id);
        if (playerTime) {
            let timeNow = new Date().getTime();
            console.log(timeNow);
            let timeDiff = timeNow - playerTime;
            if (total.has(member.id)) {
                let totalTime = total.get(member.id);
                if (totalTime) {
                    total.set(member.id, totalTime + timeDiff);
                    playerPresence.delete(member.id);
                }
            }
            else {
                total.set(member.id, timeDiff);
                playerPresence.delete(member.id);
            }
        }
    }
}
client.on("messageCreate", async (message) => {
    if (message &&
        message.content === "?resetRolesAll" &&
        message.channel.id === txtChannel) {
        // Permission gate: only administrators or role managers may run this  
        if (!message.member?.permissions.has("ADMINISTRATOR") &&
            !message.member?.permissions.has("MANAGE_ROLES")) {
            return void message.reply("Vous n'avez pas la permission d'exécuter cette commande.");
        }
        // Look up the roles we need, bail out if one is missing  
        let role = message.guild?.roles.cache.find((r) => r.name === "inscrit");
        let role2 = message.guild?.roles.cache.find((r) => r.name === "nouveau");
        if (!role || !role2) {
            return void message.channel.send("Les rôles 'inscrit' et/ou 'nouveau' sont introuvables.");
        }
        if (message.guild) {
            let listMembers = await message.guild.members.fetch();
            for (const [, member] of listMembers.filter((m) => !m.user.bot)) {
                try {
                    // Only remove if they actually have it, only add if they don’t  
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                    }
                    if (!member.roles.cache.has(role2.id)) {
                        await member.roles.add(role2);
                    }
                }
                catch (e) {
                    console.error(`Role swap failed for ${member.id}:`, e);
                }
            }
        }
        message.channel.send(`**${message.author.username}**, le rôle **${role.name}** a été retiré et le rôle **${role2.name}** ajouté à tous les membres.`);
    }
});
client.on("messageCreate", (message) => {
    if (message.content === "?start" && message.channel.id === txtChannel) {
        if (status) {
            message.channel.send("Bot is already looking");
            return;
        }
        console.log("start");
        status = true;
        voiceChannel.forEach((channel) => {
            let voiceChat = null;
            if (message && message.guild) {
                voiceChat = message.guild.channels.cache.get(channel);
            }
            if (voiceChat) {
                let members = voiceChat.members;
                if (members.size > 0) {
                    for (let member of members.values()) {
                        playerPresence.set(member.user.id, new Date().getTime());
                    }
                }
            }
        });
        message.channel.send("Bot is now looking");
    }
    else if (message.content === "?status" && message.channel.id === txtChannel) {
        console.log("status");
        if (status) {
            message.channel.send("Bot is currently looking");
        }
        else {
            message.channel.send("Bot is not looking");
        }
    }
});
client.on("messageCreate", (message) => {
    if (message.content === "?stop" && message.channel.id === txtChannel) {
        if (!status) {
            message.channel.send("Bot is not looking");
            return;
        }
        console.log("stop");
        status = false;
        voiceChannel.forEach((channel) => {
            let voiceChat = null;
            if (message && message.guild) {
                voiceChat = message.guild.channels.cache.get(channel);
            }
            if (voiceChat) {
                let members = voiceChat.members;
                if (members.size > 0) {
                    for (let member of members.values()) {
                        if (playerPresence.has(member.user.id)) {
                            let v = new Date().getTime() - playerPresence.get(member.user.id);
                            let k = member.user.id;
                            let res = v;
                            if (total && total.get(k) !== undefined) {
                                res = res + total.get(k);
                            }
                            v = 0;
                            total.set(k, res);
                            playerPresence.set(k, new Date().getTime());
                        }
                    }
                }
            }
        });
        message.channel.send("Bot is not looking anymore");
    }
});
function loadSave() {
    for (let [key, value] of saveTotal) {
        total.set(key, value);
    }
    console.log("total loaded");
    console.log(total);
    saveTotal.clear();
}
client.on("messageReactionAdd", async (reaction, _user) => {
    let msg = reaction.message;
    if (msg.id === msgReactId) {
        if (reaction.emoji.name === "✅" &&
            reaction.count &&
            reaction.count > 1) {
            loadSave();
            await msg.delete().then(_r => { });
            msg.channel.send("Chargement effectué.");
        }
        else if (reaction.emoji.name === "❎" && reaction.count && reaction.count > 1) {
            await msg.delete().then(_r => { });
        }
    }
});
client.on("messageCreate", async (message) => {
    if (message.content === "?total" && message.channel.id === txtChannel) {
        console.log("get total");
        let totalString = "";
        console.log("status: " + status);
        console.log("playerPresence.size: " + playerPresence.size);
        if (status && playerPresence.size > 0) {
            for (let [key, value] of playerPresence.entries()) {
                if (total.has(key)) {
                    total.set(key, total.get(key) + (new Date().getTime() - value));
                }
                else {
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
                    value.react("✅");
                    value.react("❎");
                });
                console.log(msgReactId);
                /*TODO message qui demande si l'on veut charger la save
                * repondre par des reaction a ce message
                * sauvegarder l'id du message
                * si l'id correspon on check la reaction
                * puis on agit
                */
            }
            else {
                message.channel.send("Pas de sauvegarde trouvée");
            }
        }
        total.forEach((value, key) => {
            let hours = Math.floor(value / 3600000);
            let minutes = Math.floor((value % 3600000) / 60000);
            let seconds = Math.floor(((value % 3600000) % 60000) / 1000);
            totalString += key + " : " + hours + "h " + minutes + "m " + seconds + "s\n";
        });
        if (totalString !== "") {
            message.channel.send(totalString);
        }
    }
});
function clearing() {
    console.log("clear");
    playerPresence.clear();
    for (let [key, value] of total) {
        saveTotal.set(key, value);
    }
    console.log("save total");
    console.log(saveTotal);
    total.clear();
}
client.on("messageCreate", (message) => {
    if (message.content === "?clear" && message.channel.id === txtChannel) {
        clearing();
    }
});
client.on("messageCreate", (message) => {
    if (message.content === "?help" && message.channel.id === txtChannel) {
        console.log("help");
        message.channel.send("?start: démarre la recherche de joueurs\n?stop: arrête la recherche de joueurs\n?status: affiche le status de la recherche\n?total: affiche le total de présence de tous les joueurs\n?clear: supprime toutes les données\n?help: affiche ce message");
    }
});
client.on("messageCreate", (message) => {
    if (message.content.startsWith("?") && !cmdList.includes(message.content) && message.channel.id === txtChannel && !message.author.bot) {
        message.channel.send("Commande inconnue !\n?start: démarre la recherche de joueurs\n?stop: arrête la recherche de joueurs\n?status: affiche le status de la recherche\n?total: affiche le total de présence de tous les joueurs\n?clear: supprime toutes les données\n?help: affiche ce message");
    }
});
client.on("messageCreate", async (message) => {
    if (message.content === "?export" && !status && message.channel.id === txtChannel) {
        let dayDate = new Date();
        let day = dayDate.getDate();
        let month = dayDate.getMonth() + 1;
        let dateValue = "";
        if (day < 10) {
            dateValue = "0" + day;
        }
        else {
            dateValue = "" + day;
        }
        if (month < 10) {
            dateValue = dateValue + "/0" + month;
        }
        else {
            dateValue = dateValue + "/" + month;
        }
        total.forEach((value, key) => {
            let player = playersInfo.get(key);
            if (player === undefined) {
                message.channel.send("Probleme ! Le joueur <@" + key + "> n'est pas dans la liste de joueur inscrit, voici son temps de jeu (timestamp) : " + value);
                return;
            }
            let calc = 0;
            let actual = player.tempsDeJeu;
            let aDay = actual.substring(0, actual.indexOf("j"));
            calc = calc + (parseInt(aDay) * 24 * 60 * 60 * 1000);
            let aHour = actual.substring(actual.indexOf("j") + 2, actual.indexOf("h"));
            calc = calc + (parseInt(aHour) * 60 * 60 * 1000);
            let aMinute = actual.substring(actual.indexOf("h") + 2, actual.indexOf("m"));
            calc = calc + (parseInt(aMinute) * 60 * 1000);
            let aSecond = actual.substring(actual.indexOf("m") + 2, actual.indexOf("s"));
            calc = calc + (parseInt(aSecond) * 1000);
            let ms = calc + value;
            let days = Math.floor(ms / (24 * 60 * 60 * 1000));
            let daysms = ms % (24 * 60 * 60 * 1000);
            let hours = Math.floor(daysms / (60 * 60 * 1000));
            let hoursms = daysms % (60 * 60 * 1000);
            let minutes = Math.floor(hoursms / (60 * 1000));
            let minutesms = hoursms % (60 * 1000);
            let sec = Math.floor(minutesms / 1000);
            player.tempsDeJeu = days + "j " + hours + "h " + minutes + "m " + sec + "s";
            let msV = value;
            let daysmsV = msV % (24 * 60 * 60 * 1000);
            let hoursV = Math.floor(daysmsV / (60 * 60 * 1000));
            let hoursmsV = daysmsV % (60 * 60 * 1000);
            let minutesV = Math.floor(hoursmsV / (60 * 1000));
            let minutesmsV = hoursmsV % (60 * 1000);
            let secV = Math.floor(minutesmsV / 1000);
            if (hoursV > 0 || minutesV >= minimalTime) {
                player.point = player.point + 1;
            }
            player.dates[dateValue] = (hoursV + "h " + minutesV + "m " + secV + "s");
            playersInfo.set(key, player);
        });
        savePlayersToFile(playersInfo, "./data.json");
        clearing();
        message.channel.send("OK ! (Si l'export à été fait trop tôt, vous pouvez faire un ?total et recharger la dernière sauvegarde, ou importer la save générer)");
        //sendFile
        message.channel.send({
            files: [
                {
                    attachment: "./data.json",
                    name: "export.json"
                }
            ]
        });
    }
});
client.on("messageCreate", async (message) => {
    if ((message.content.startsWith("?inscription") || (message.content.startsWith("?adminInscription") && message.member?.user.id === "210066772483637248")) && message.channel.id === inscriptionChannel) {
        let member = message.member;
        let msg = message.content;
        let list = msg.split(" ");
        let discordName = "";
        let name = "";
        let lastName = "";
        let classe = "";
        let mail = "";
        let userName = "";
        let check = true;
        let playerInfo = {
            discord: "",
            pseudoRL: "",
            nom: "",
            prenom: "",
            classe: "",
            mailMyges: "",
            tempsDeJeu: "",
            point: 0,
            dates: {}
        };
        if (message.content.startsWith("?inscription")) {
            if (msg.split(" ").length === 6) {
                discordName = message.member.user.id;
                name = list[1];
                lastName = list[2];
                classe = list[3];
                mail = list[4];
                if (!mail.includes("@")) {
                    message.channel.send("<@" + message.member?.id + "> Vous devez indiquer votre nom prenom classe mail_myges et pseudo RL. (ex: ?inscription FERREIRA Mathieu 5AL mferreira30@myges.fr Sn0wFR) ");
                    return;
                }
                userName = list[5];
                playerInfo = {
                    discord: discordName,
                    pseudoRL: userName,
                    nom: name,
                    prenom: lastName,
                    classe: classe,
                    mailMyges: mail,
                    tempsDeJeu: "0j 0h 0m 0s",
                    point: 0,
                    dates: {}
                };
            }
            else {
                message.channel.send("<@" + message.member?.id + "> Vous devez indiquer votre nom prenom classe mail_myges et pseudo RL. (ex: ?inscription FERREIRA Mathieu 5AL mferreira30@myges.fr Sn0wFR) ");
                return;
            }
        }
        else if (message.content.startsWith("?adminInscription")) {
            if (msg.split(" ").length === 7) {
                discordName = list[1];
                // get all member
                let members = await message.guild?.members.fetch();
                let memberFind = members?.find((member) => member.user.id === discordName);
                if (!memberFind) {
                    message.channel.send("L'utilisateur n'existe pas !");
                    return;
                }
                else {
                    member = memberFind;
                }
                name = list[2];
                lastName = list[3];
                classe = list[4];
                mail = list[5];
                userName = list[6];
                playerInfo = {
                    discord: discordName,
                    pseudoRL: userName,
                    nom: name,
                    prenom: lastName,
                    classe: classe,
                    mailMyges: mail,
                    tempsDeJeu: "0j 0h 0m 0s",
                    point: 0,
                    dates: {}
                };
            }
        }
        for (const playerId of playersInfo.keys()) {
            if (playerId === discordName) {
                check = false;
                break;
            }
        }
        if (!check) {
            message.channel.send("<@" + member?.id + "> Vous êtes déjà inscrit, Si vous voyez ce message contacter <@210066772483637248>");
            return;
        }
        playersInfo.set(discordName, playerInfo);
        //write playersInfo data
        savePlayersToFile(playersInfo, "./data.json");
        message.channel.send("<@" + member?.id + "> Vous êtes maintenant inscrit");
        let role = message.guild?.roles.cache.find((role) => role.name === "inscrit");
        let role2 = message.guild?.roles.cache.find((role) => role.name === "nouveau");
        if (role && role2 && message.member) {
            await member.roles.add(role);
            await member.roles.remove(role2);
        }
        else {
            message.channel.send("Le role 'inscrit' ou 'nouveau' n'existe pas ou alors le membre à 'disparu' ??????, veuillez contacter <@210066772483637248>");
        }
    }
});
client.on("guildMemberAdd", (member) => {
    console.log("add");
    let role = member.guild.roles.cache.find(role => role.name === "nouveau");
    if (role) {
        console.log("trouver");
        member.roles.add(role);
    }
    console.log("fin");
});
client.on("messageCreate", async (message) => {
    if (message.content.startsWith("?sendRapport") &&
        message.channel.id === rapportChannel) {
        const debugChannel = message.guild?.channels.cache.find((channel) => channel.id === logRapportChannel);
        if (!debugChannel) {
            return void message.reply("Canal de log (LOG_RAPPORT) introuvable.");
        }
        let id = message.member.user.id;
        await debugChannel.send("- <@" + id + "> - Rapport en cours de traitement");
        let msg = "";
        let playerInfo = playersInfo.get(id);
        if (playerInfo === undefined) {
            await debugChannel.send("- <@" + message.member?.user.id + "> - Info non trouvée, n'a pas participé aux sessions");
            await message.member?.send("Info non trouvée, vous n'avez pas participé aux sessions").catch(console.error);
            return;
        }
        msg = msg + "PseudoRL : " + playerInfo.pseudoRL + "\nNom : " + playerInfo.nom + "\nPrenom : " + playerInfo.prenom + "\nClasse : " + playerInfo.classe + "\nMail MyGES : " + playerInfo.mailMyges + "\nTemps de jeu : " + playerInfo.tempsDeJeu + "\nPoint : " + playerInfo.point + "\n";
        await message.member?.send(msg).catch(console.error);
        await debugChannel.send("- <@" + message.member?.user.id + "> - Message envoyé");
    }
});
//# sourceMappingURL=index.js.map