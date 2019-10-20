const { Client, Util } = require("discord.js");
const { token, prefix, googleKey } = require("./config.json");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");

const client = new Client({ disableEveryone: true });

const youtube = new YouTube(googleKey);

const queue = new Map();

client.on("warn", console.warn);

client.on("error", console.error);

client.on("ready", () => console.log("Yo this ready!"));

client.on("disconnect", () =>
  console.log(
    "I just disconnected, making sure you know, I will reconnect now..."
  )
);

client.on("reconnecting", () => console.log("I am reconnecting now!"));

client.on("message", async msg => {
  // eslint-disable-line
  if (msg.author.bot) return undefined;
  if (!msg.content.startsWith(prefix)) return undefined;

  const args = msg.content.split(" ");
  const searchString = args.slice(1).join(" ");
  const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
  const serverQueue = queue.get(msg.guild.id);

  let command = msg.content.toLowerCase().split(" ")[0];
  command = command.slice(prefix.length);

  if (command === "play") {
    const voiceChannel = msg.member.voiceChannel;
    if (!voiceChannel)
      return msg.channel.send(
        "Liity kanavalle ennen kuin haluat pistää kullervon päälle"
      );
    const permissions = voiceChannel.permissionsFor(msg.client.user);
    if (!permissions.has("CONNECT")) {
      return msg.channel.send(
        "Sinulla ei riitä oikeudet, ilmoita moderaattorille"
      );
    }
    if (!permissions.has("SPEAK")) {
      return msg.channel.send(
        "Sinulla ei riitä oikeudet, ilmoita moderaattorille"
      );
    }

    if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
      const playlist = await youtube.getPlaylist(url);
      const videos = await playlist.getVideos();
      for (const video of Object.values(videos)) {
        const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
        await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
      }
      return msg.channel.send(`**${playlist.title}** lisätty jonoon!`);
    } else {
      try {
        var video = await youtube.getVideo(url);
      } catch (error) {
        try {
          var videos = await youtube.searchVideos(searchString, 5);
          let index = 0;
          msg.channel.send(`
__**Kappaleet:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join("\n")}
Valitse kappale numeroista 1-5.
					`);
          // eslint-disable-next-line max-depth
          try {
            var response = await msg.channel.awaitMessages(
              msg2 => msg2.content > 0 && msg2.content < 6,
              {
                maxMatches: 1,
                time: 10000,
                errors: ["time"]
              }
            );
          } catch (err) {
            console.error(err);
            return msg.channel.send(
              "Kappaleita ei valittu ajallaan, peruutetaan"
            );
          }
          const videoIndex = parseInt(response.first().content);
          var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
        } catch (err) {
          console.error(err);
          return msg.channel.send(
            "En löytänyt mitään videoita, yritä uudelleen."
          );
        }
      }
      return handleVideo(video, msg, voiceChannel);
    }
  } else if (command === "skip") {
    if (!msg.member.voiceChannel)
      return msg.channel.send("Liity kanavalle ensin!");
    if (!serverQueue) return msg.channel.send("Mitään ei soi tällä hetkellä");
    serverQueue.connection.dispatcher.end("Skippasit laatu bängerin");
    return undefined;
  } else if (command === "stop") {
    if (!msg.member.voiceChannel)
      return msg.channel.send("Liity kanavalle ensin!");
    if (!serverQueue) return msg.channel.send("Mitään ei soi tällä hetkellä");
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end("Lopetit laatu bängerin!");
    return undefined;
  } else if (command === "np") {
    if (!serverQueue) return msg.channel.send("Mitään ei soi tällä hetkellä");
    return msg.channel.send(`🎶 Nyt soi: **${serverQueue.songs[0].title}**`);
  } else if (command === "queue") {
    if (!serverQueue) return msg.channel.send("Mitään ei soi tällä hetkellä");
    return msg.channel.send(`
__**Värssylista:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join("\n")}
**Nyt soi:** ${serverQueue.songs[0].title}
		`);
  } else if (command === "pause") {
    if (serverQueue && serverQueue.playing) {
      serverQueue.playing = false;
      serverQueue.connection.dispatcher.pause();
      return msg.channel.send("⏸ Musiikki pausetettu!");
    }
    return msg.channel.send("Mitään ei soi tällä hetkellä");
  } else if (command === "resume") {
    if (serverQueue && !serverQueue.playing) {
      serverQueue.playing = true;
      serverQueue.connection.dispatcher.resume();
      return msg.channel.send("▶ Ja taas jatkuu!");
    }
    return msg.channel.send("Mitään ei soi tällä hetkellä");
  }

  return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
  const serverQueue = queue.get(msg.guild.id);
  console.log(video);
  const song = {
    id: video.id,
    title: Util.escapeMarkdown(video.title),
    url: `https://www.youtube.com/watch?v=${video.id}`
  };
  if (!serverQueue) {
    const queueConstruct = {
      textChannel: msg.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };
    queue.set(msg.guild.id, queueConstruct);

    queueConstruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueConstruct.connection = connection;
      play(msg.guild, queueConstruct.songs[0]);
    } catch (error) {
      console.error(`I could not join the voice channel: ${error}`);
      queue.delete(msg.guild.id);
      return msg.channel.send(
        `En voinut liittyä kanavalle, soita äkkiä hakkerille: ${error}`
      );
    }
  } else {
    serverQueue.songs.push(song);
    console.log(serverQueue.songs);
    if (playlist) return undefined;
    else return msg.channel.send(`✅ **${song.title}** on lisätty jonoon!`);
  }
  return undefined;
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
  console.log(serverQueue.songs);

  const dispatcher = serverQueue.connection
    .playStream(ytdl(song.url))
    .on("end", reason => {
      if (reason === "Stream is not generating quickly enough.")
        console.log("Song ended.");
      else console.log(reason);
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

  serverQueue.textChannel.send(`🎶 Nyt soi: **${song.title}**`);
}

client.login(token);
