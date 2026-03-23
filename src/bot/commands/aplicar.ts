import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aplicar')
    .setDescription('Aplica para unirte a la guild'),
  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('application_modal')
      .setTitle('Aplicacion a la Guild');

    const charName = new TextInputBuilder()
      .setCustomId('character_name')
      .setLabel('Nombre de personaje - Servidor')
      .setPlaceholder('Ej: Thrall-Ragnaros')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const classSpec = new TextInputBuilder()
      .setCustomId('class_spec')
      .setLabel('Clase y Spec principal')
      .setPlaceholder('Ej: Warrior - Arms')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const experience = new TextInputBuilder()
      .setCustomId('experience')
      .setLabel('Experiencia en Raid / M+')
      .setPlaceholder('Cuenta tu experiencia: CE, KSH, score mas alto, etc.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const motivation = new TextInputBuilder()
      .setCustomId('motivation')
      .setLabel('Que buscas en la guild?')
      .setPlaceholder('Que esperas encontrar aqui?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const availability = new TextInputBuilder()
      .setCustomId('availability')
      .setLabel('Disponibilidad horaria')
      .setPlaceholder('Ej: Lunes a Jueves 8pm-11pm CST')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(charName),
      new ActionRowBuilder<TextInputBuilder>().addComponents(classSpec),
      new ActionRowBuilder<TextInputBuilder>().addComponents(experience),
      new ActionRowBuilder<TextInputBuilder>().addComponents(motivation),
      new ActionRowBuilder<TextInputBuilder>().addComponents(availability),
    );

    await interaction.showModal(modal);
  },
};
