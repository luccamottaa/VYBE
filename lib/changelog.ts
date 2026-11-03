// "Novidades" do vybe. A primeira entrada é a versão atual (aparece no selo do topo).
export type Release = { version: string; date: string; title: string; items: string[] };

export const releases: Release[] = [
  {
    version: '2.5',
    date: '2026-11-03',
    title: 'Mais vivo, mais seguro',
    items: [
      'Abertura animada com a logo ao entrar no vybe (uma vez por sessão; um toque pula).',
      'Link compartilhado de música ou artista agora abre direto, mesmo na primeira vez que a pessoa entra.',
      'Painel do artista com a foto dele no fundo, em movimento, e topo e barra de abas com animações mais suaves.',
      'O site acompanha o tamanho do texto do celular (iPhone e Android).',
      'Resumo do dia (opcional): uma notificação de manhã com onde quem você segue está. Os avisos também ficaram mais confiáveis.',
      'Excluir minha conta direto no app, e estatísticas anônimas só se você aceitar (dá pra mudar no rodapé).',
      'Se o contador de streams estiver no limite, o vybe mostra o último valor guardado ou o total do kworb em vez de ficar vazio.',
    ],
  },
  {
    version: '2.4',
    date: '2026-11-03',
    title: 'Conta e avisos com o app fechado',
    items: [
      'Entre com Google (opcional): quem você segue, seus alertas e o layout do início ficam iguais no celular e no computador.',
      'Escolha sua foto de perfil entre 18 avatares do vybe.',
      'Avisos com o app fechado: quando alguém que você segue sobe no chart, a notificação chega mesmo sem abrir o vybe. No iPhone, instale o app na Tela de Início primeiro.',
      'Política de Privacidade atualizada pra explicar a conta e as notificações.',
    ],
  },
  {
    version: '2.3',
    date: '2026-11-03',
    title: 'Liquid glass',
    items: [
      'Visual de vidro no app todo: topo e barra de abas com vidro de verdade, cards com vidro leve que deixa o fundo vivo aparecer.',
      'No celular, as abas viram uma barra flutuante embaixo, no alcance do dedão, que encolhe quando você rola.',
      'Busca por voz: toque no 🎤 e fale o nome da música ou do artista.',
      'Escolha o que te avisa: #1, top 10, estreias, marcos de streams ou quando sai de um chart.',
      'Personalize o início: esconda ou mude a ordem das seções.',
      'Lançamentos de quem você segue, com o que saiu no último mês e o que já tem data.',
      'Painéis abrem com efeito de mola, e os cards não ficam mais cortados na borda.',
      'Política de Privacidade e Termos de Uso no rodapé.',
    ],
  },
  {
    version: '2.2',
    date: '2026-11-03',
    title: 'Tela nova',
    items: [
      'Início redesenhado: cards de destaque com a capa inteira (maior alta, estreia, mais ouvida, lançamento fresco, veterana) e artistas do momento em bolinhas com foto.',
      'Grupos e duplas com "x" ou "&" no nome (TOMORROW X TOGETHER, Henrique & Juliano…) não se partem mais: catálogo, discografia e charts aparecem certinho.',
      'O topo não fica mais pulando ao rolar a página.',
      'Ranking mais enxuto: começa no top 10 e abre o top 100 completo num toque.',
    ],
  },
  {
    version: '2.1',
    date: '2026-11-03',
    title: 'Um ranking só',
    items: [
      'Apple Music e Spotify juntos no Top 100 vybe: cada plataforma dá pontos pela posição e a soma ordena a lista. Escolha Global ou um país.',
      'Cada música mostra a posição na Apple e no Spotify; tocar abre todos os charts, streams e histórico dela.',
      'iPhone: o X dos painéis fica sempre visível abaixo do relógio, dá pra fechar arrastando pro lado e o topo não fica mais embaixo da Dynamic Island.',
      'Mais leve no celular: menos efeito de vidro e a animação do #1 em 30 quadros.',
      'Fundo vivo: manchas de cor que flutuam devagar com as cores da capa do #1 (ou da música/álbum aberto).',
      'Músicas com título em coreano ou japonês não se misturam mais.',
    ],
  },
  {
    version: '2.0',
    date: '2026-11-02',
    title: 'vybe vira app',
    items: [
      'Instale o vybe no celular ou no computador: abre em tela cheia e funciona offline com o último ranking visto.',
      'Siga artistas e músicas (⭐) e acompanhe tudo na aba Seguindo.',
      'Alertas quando quem você segue entra no top 10, chega ao #1, estreia num chart ou passa de 100 mi de streams.',
      'Aba Destaques: #1 de cada chart, músicas em todo lugar, artistas do momento, Brasil × Mundo e a retrospectiva do mês.',
      'Álbuns: Top 100 álbuns da Apple Music nos 5 países, página de cada álbum com faixas e quem está nos charts, discografia no artista e álbuns na busca.',
      'Card pra compartilhar qualquer música, álbum ou artista no story, com posições e streams.',
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
