// Links diretos pro vybe: ?fonte=spotify&mercado=br, ?aba=destaques, ?musica=Nome&artista=Artista, ?artista=Nome, ?buscar=termo
export type DeepLink = {
  fonte?: 'apple' | 'spotify';
  pais?: string;
  mercado?: string;
  aba?: 'charts' | 'destaques' | 'seguindo' | 'fontes';
  buscar?: string;
  musica?: string;
  album?: string;
  artista?: string;
  tipo?: 'musicas' | 'albuns';
  spotify?: string; // id da faixa no Spotify
  apple?: string; // id da faixa na Apple
};

const tabs = ['charts', 'destaques', 'seguindo', 'fontes'] as const;

export function readDeepLink(search: string): DeepLink {
  const p = new URLSearchParams(search);
  const get = (k: string) => p.get(k)?.trim().slice(0, 200) || undefined;
  const fonte = get('fonte');
  const aba = get('aba');
  const cc = (v?: string) => (v && /^[a-z]{2}$|^global$/.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
  const id = (v?: string) => (v && /^[A-Za-z0-9]{1,40}$/.test(v) ? v : undefined);
  return {
    fonte: fonte === 'apple' || fonte === 'spotify' ? fonte : undefined,
    pais: cc(get('pais')),
    mercado: cc(get('mercado')),
    aba: tabs.includes(aba as (typeof tabs)[number]) ? (aba as DeepLink['aba']) : undefined,
    buscar: get('buscar'),
    musica: get('musica'),
    album: get('album'),
    tipo: get('tipo') === 'albuns' ? 'albuns' : undefined,
    artista: get('artista'),
    spotify: id(get('spotify')),
    apple: id(get('apple')),
  };
}

export function buildDeepLink(link: DeepLink, origin = typeof location !== 'undefined' ? location.origin : '') {
  const base = import.meta.env.BASE_URL ?? '/';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(link)) if (v) p.set(k, v);
  const qs = p.toString();
  return `${origin}${base}${qs ? `?${qs}` : ''}`;
}
