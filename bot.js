/**
 * Discord.js v14 Anime‑Styled Ticket Bot (with guaranteed embed)
 * Prefix Commands: !setup, !panel, !status, !close
 * Config stored in ticket_bot_config.json
 * Uses a fallback gif from Giphy that always works
 */


const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot alive');
});

app.listen(3000, () => {
  console.log('Express server ready');
});

const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const PREFIX = '!';
const CONFIG_PATH = './ticket_bot_config.json';
// Fallback GIF that is known to work in Discord embeds (from Giphy)
const DEFAULT_GIF = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbjRuaHNvN3hyY2tvaHJkN2E3enYxeG1uYWFnd3h6NnQyZnhidHc3ayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/RlHpuVwtbvdIBXzm2z/giphy.gif';
let config = {};

// Initialize or load config
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} else {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({}), 'utf8');
}

// Sample anime quotes
const animeQuotes = [
  "Believe in yourself. Not in the you who believes in me. Believe in the you who believes in yourself. – Kamina",
  "A lesson without pain is meaningless. That’s because no one can gain without sacrificing something. – Edward Elric",
  "The moment you think of giving up, think of the reason why you held on so long. – Natsu Dragneel",
  "If you don’t take risks, you can’t create a future! – Monkey D. Luffy",
  "We each need to find our own inspiration. Sometimes, it’s not easy. – Kikyō"
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', () => console.log('Bot online! Awaiting chaos...'));

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/ +/);
  const gid = message.guild.id;

  // ----- SETUP -----
  if (cmd === 'setup') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('Administrator perms needed!');

    const role = message.mentions.roles.first();
    const color = args.find(a => /^#?[0-9A-Fa-f]{6}$/.test(a));
    const gif = args.find(a => /^https?:.*\.(?:gif|png|jpe?g)$/.test(a));
    if (!role || !color) return message.reply('Usage: !setup @staff #hexColor [optional direct image URL]');

    config[gid] = {
      roleId: role.id,
      color: color.startsWith('#') ? color : `#${color}`,
      gif: gif || DEFAULT_GIF
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return message.reply(`Setup saved! Staff: ${role}, Color: ${config[gid].color}, GIF: ${config[gid].gif}`);
  }

  // ----- PANEL -----
  if (cmd === 'panel') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('Admins only!');

    const conf = config[gid];
    if (!conf) return message.reply('Run !setup first.');

    const embed = new EmbedBuilder()
      .setTitle('🎫 Need Help?')
      .setDescription('Click below to open a support ticket!')
      .setColor(conf.color)
      .setImage(conf.gif || DEFAULT_GIF);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('🎟 Create Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    return message.channel.send({ embeds: [embed], components: [btnRow] });
  }

  // ----- STATUS -----
  if (cmd === 'status') {
    const count = message.guild.channels.cache.filter(ch => ch.name.startsWith('ticket-')).size;
    return message.reply(`Currently ${count} open ticket(s).`);
  }

  // ----- CLOSE -----
  if (cmd === 'close') {
    if (!message.channel.name.startsWith('ticket-'))
      return message.reply('Use this inside a ticket channel!');

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
        !message.channel.permissionsFor(message.author).has(PermissionsBitField.Flags.ViewChannel)) {
      return message.reply('Cannot close this ticket.');
    }

    await message.channel.send('Closing in 5 seconds...');
    setTimeout(() => message.channel.delete(), 5000);
  }
});

client.on('interactionCreate', async inter => {
  if (!inter.isButton()) return;
  const { guild, user, customId, channel } = inter;
  const conf = config[guild.id];

  if (customId === 'create_ticket') {
    await inter.deferReply({ ephemeral: true });
    if (!conf) return inter.editReply('Panel not set up.');

    const name = `ticket-${user.username.toLowerCase()}`;
    if (guild.channels.cache.some(ch => ch.name === name))
      return inter.editReply('You already have an open ticket.');

    const ticketCh = await guild.channels.create({
      name,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: conf.roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ],
      type: 0
    });

    console.log('Ticket jutsu activated!');
    const quote = animeQuotes[Math.floor(Math.random() * animeQuotes.length)];
    const welcome = new EmbedBuilder()
      .setTitle(`Hi ${user.username}, how can we help?`)
      .setDescription(quote)
      .setColor(conf.color)
      .setImage(conf.gif || DEFAULT_GIF);

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🗑 Close Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketCh.send({ content: `<@${user.id}>`, embeds: [welcome], components: [closeBtn] });
    return inter.editReply(`Your ticket: ${ticketCh}`);
  }

  if (customId === 'close_ticket') {
    await inter.deferReply({ ephemeral: true });
    await channel.send('Closing in 5 seconds...');
    setTimeout(() => channel.delete(), 5000);
    return inter.editReply('Ticket will close soon.');
  }
});


client.login(process.env.TOKEN);

