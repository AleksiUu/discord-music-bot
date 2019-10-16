const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const client = new Discord.Client();
const ytdl = require("ytdl-core");

client.login(token);

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnecting!");
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else {
    message.channel.send("Älä käytä tuommosia komentoja!");
  }
});

const queue = new Map();

async function execute(message, serverQueue) {
  const args = message.content.split(" ");
  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel) {
    return message.channel.send("Mene kanavalle törppö");
  }
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "Otathan yhteyttä kanavan ylläpitäjiin saadaksesi oikeudet puhua tällä kanavalla."
    );
  }

  const songInfo = await ytdl.getInfo(args[1]);
  console.log(songInfo);
  const song = {
    title: songInfo.title,
    url: songInfo.video_url
  };

  if (!serverQueue) {
  } else {
    serverQueue.songs.push(song);
    console.log(serverQueue.songs);
    return message.channel.send(`${song.title} pärähtää kohta soimaan!`);
  }
  try {
    let connection = await voiceChannel.join();
  } catch (err) {
    console.log(err);
  }
}
