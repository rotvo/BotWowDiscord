import { EmbedBuilder, type Client } from 'discord.js';

export async function notifyRequester(
  client: Client,
  requesterId: string,
  itemName: string,
  profession: string,
  crafterId: string,
  characterName?: string,
): Promise<void> {
  try {
    const user = await client.users.fetch(requesterId);
    const charStr = characterName ? ` con **${characterName}**` : '';
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('Tu pedido de crafteo fue aceptado')
        .setDescription(
          `<@${crafterId}>${charStr} acepto tu pedido de **${itemName}** (${profession}).\n\n` +
          `Contactalo en el servidor para coordinar la entrega.`,
        )
        .setTimestamp()],
    });
  } catch {
    // DMs disabled
  }
}
