import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from './constants.js';

export function successEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.success)
    .setTitle(title)
    .setDescription(description ?? null)
    .setTimestamp();
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.danger)
    .setTitle(title)
    .setDescription(description ?? null)
    .setTimestamp();
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.info)
    .setTitle(title)
    .setDescription(description ?? null)
    .setTimestamp();
}

export function wowEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.wow)
    .setTitle(title)
    .setDescription(description ?? null)
    .setTimestamp();
}
