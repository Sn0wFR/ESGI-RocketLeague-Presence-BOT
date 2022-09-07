import {config} from "dotenv";

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
})