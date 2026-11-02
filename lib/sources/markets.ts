// Países acompanhados pelo vybe. Módulo puro (sem dependência de navegador).
export const markets: Record<string, { name: string; flag: string }> = {
  br: { name: 'Brasil', flag: '🇧🇷' },
  us: { name: 'Estados Unidos', flag: '🇺🇸' },
  kr: { name: 'Coreia do Sul', flag: '🇰🇷' },
  jp: { name: 'Japão', flag: '🇯🇵' },
  gb: { name: 'Reino Unido', flag: '🇬🇧' },
};

export const globalMarket = { name: 'Global', flag: '🌍' };

/** "ap:br" → "Apple 🇧🇷"; "sp:global" → "Spotify 🌍". */
export function marketLabel(m: string) {
  const [src, id] = m.split(':');
  const flag = id === 'global' ? globalMarket.flag : (markets[id]?.flag ?? id.toUpperCase());
  return `${src === 'ap' ? 'Apple' : 'Spotify'} ${flag}`;
}

/** "ap:br" → "Apple Music Brasil"; "sp:global" → "Spotify Global". */
export function marketName(m: string) {
  const [src, id] = m.split(':');
  return `${src === 'ap' ? 'Apple Music' : 'Spotify'} ${id === 'global' ? globalMarket.name : (markets[id]?.name ?? id.toUpperCase())}`;
}
