import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { EMBED_COLORS } from '../../utils/constants.js';

const CATEGORIES: { name: string; commands: { cmd: string; desc: string }[] }[] = [
  {
    name: 'Inicio',
    commands: [
      { cmd: '/vincular', desc: 'Vincula tu personaje de WoW' },
      { cmd: '/mis-personajes', desc: 'Administra tus personajes vinculados' },
      { cmd: '/actualizar', desc: 'Actualiza tu ilvl y M+ score' },
      { cmd: '/personaje', desc: 'Busca info de cualquier personaje' },
    ],
  },
  {
    name: 'Raids',
    commands: [
      { cmd: '/crear-raid', desc: 'Crea una raid con fecha y dificultad' },
      { cmd: '/cancelar-raid', desc: 'Cancela una raid programada' },
      { cmd: '/log-raid', desc: 'Registra resultado de una raid' },
    ],
  },
  {
    name: 'Miticas+',
    commands: [
      { cmd: '/buscar-key', desc: 'Publica un grupo de M+' },
      { cmd: '/cerrar-grupo', desc: 'Cierra un grupo de M+' },
      { cmd: '/afijos', desc: 'Afijos de la semana' },
      { cmd: '/ranking-mplus', desc: 'Ranking M+ de la guild' },
    ],
  },
  {
    name: 'Profesiones y Crafting',
    commands: [
      { cmd: '/profesiones registrar', desc: 'Registra una profesion' },
      { cmd: '/profesiones buscar', desc: 'Busca guildies por profesion' },
      { cmd: '/profesiones mias', desc: 'Ve tus profesiones' },
      { cmd: '/crafting-order crear', desc: 'Pide un item crafteado' },
      { cmd: '/crafting-order completar', desc: 'Marca pedido como listo' },
      { cmd: '/crafting-order cancelar', desc: 'Cancela un pedido' },
      { cmd: '/crafting-order mis-pedidos', desc: 'Ve tus pedidos activos' },
    ],
  },
  {
    name: 'Guild',
    commands: [
      { cmd: '/guild-progress', desc: 'Progreso de raid de la guild' },
      { cmd: '/info-guild', desc: 'Info general de la guild' },
      { cmd: '/aplicar', desc: 'Aplica para unirte a la guild' },
      { cmd: '/reclutamiento', desc: 'Publica anuncio de reclutamiento' },
    ],
  },
  {
    name: 'Otros',
    commands: [
      { cmd: '/help', desc: 'Muestra este menu de ayuda' },
      { cmd: '/ping', desc: 'Verifica que el bot esta activo' },
      { cmd: '/stream', desc: 'Anuncia un stream' },
      { cmd: '/youtube', desc: 'Consulta videos del canal' },
    ],
  },
];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos disponibles organizados por categoria'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.info)
      .setTitle('Comandos del Bot')
      .setDescription('Todos los comandos organizados por categoria.')
      .setFooter({ text: 'WoW Guild Bot — usa /comando para ejecutar' })
      .setTimestamp();

    for (const cat of CATEGORIES) {
      const lines = cat.commands.map((c) => `\`${c.cmd}\` — ${c.desc}`);
      embed.addFields({ name: cat.name, value: lines.join('\n') });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
