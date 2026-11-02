// "Novidades" do vybe. A primeira entrada é a versão atual (aparece no selo do topo).
export type Release = { version: string; date: string; title: string; items: string[] };

export const releases: Release[] = [
  {
    version: '2.0',
    date: '2026-11-02',
    title: 'vybe vira app',
    items: [
      'Instale o vybe no celular ou no computador: abre em tela cheia e funciona offline com o último ranking visto.',
      'Siga artistas e músicas (⭐) e acompanhe tudo na aba Seguindo.',
      'Alertas quando quem você segue entra no top 10, chega ao #1, estreia num chart ou passa de 100 mi de streams.',
      'Aba Destaques: #1 de cada chart, músicas em todo lugar, artistas do momento, Brasil × Mundo e a retrospectiva do mês.',
      'Card pra compartilhar qualquer música ou artista no story, com posições e streams.',
      'Links diretos e páginas próprias pra cada música e artista (bom pra mandar no grupo e pro Google achar).',
      'Topo compacto ao rolar, mais vidro e mais respiro no celular.',
    ],
  },
  {
    version: '1.4',
    date: '2026-11-02',
    title: 'Streams de tudo',
    items: ['Total de streams de qualquer música no Spotify, com histórico por dia e zoom.', 'Histórico completo nos charts do Spotify desde a primeira entrada.'],
  },
  {
    version: '1.3',
    date: '2026-11-02',
    title: 'Busca que acha tudo',
    items: ['Busca no catálogo inteiro (Spotify, Apple e Deezer) com prévia de 30 s.', 'Página de artista com catálogo completo.'],
  },
  {
    version: '1.2',
    date: '2026-11-02',
    title: 'Spotify por país',
    items: ['Top 200 diário do Spotify no Global, Brasil, EUA, Coreia, Japão e Reino Unido.', 'Ouvintes e scrobbles do Last.fm.'],
  },
  {
    version: '1.0',
    date: '2026-10-03',
    title: 'Nasce o vybe',
    items: ['Top 100 do Apple Music em 5 países, tema claro e escuro, logo animada.'],
  },
];

export const VERSION = releases[0].version;
