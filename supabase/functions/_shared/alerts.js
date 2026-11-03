//#region lib/sources/match.ts
var GROUPS = [
	"TOMORROW X TOGETHER",
	"Tyler, The Creator",
	"Earth, Wind & Fire",
	"Simon & Garfunkel",
	"Florence + The Machine",
	"Mumford & Sons",
	"Hall & Oates",
	"Brooks & Dunn",
	"Dan + Shay",
	"Big & Rich",
	"Crosby, Stills, Nash & Young",
	"Chitãozinho & Xororó",
	"Zezé Di Camargo & Luciano",
	"Henrique & Juliano",
	"Jorge & Mateus",
	"Maiara & Maraisa",
	"Matheus & Kauan",
	"Zé Neto & Cristiano",
	"Bruno & Marrone",
	"Israel & Rodolffo",
	"Diego & Victor Hugo",
	"Hugo & Guilherme",
	"César Menotti & Fabiano",
	"Simone & Simaria",
	"Marcos & Belutti",
	"Munhoz & Mariano",
	"Kaique & Felipe",
	"Clayton & Romário",
	"Guilherme & Benuto",
	"Fernando & Sorocaba",
	"Edson & Hudson",
	"Rionegro & Solimões",
	"João Gustavo & Murilo",
	"Thiago & Graciano",
	"Hugo & Tiago",
	"Day & Lara",
	"Lucas & Felipe",
	"Panda & MJ Records",
	"Grupo Menos É Mais",
	"Sandy & Junior",
	"Kid Abelha & Os Abóboras Selvagens",
	"Belo & Gaab",
	"Ivete Sangalo & Ludmilla",
	"Peter, Paul & Mary",
	"Mike + The Mechanics",
	"Hootie & The Blowfish",
	"Marina and The Diamonds",
	"Florence and the Machine",
	"Selena Gomez & The Scene",
	"Huey Lewis & The News",
	"Bob Marley & The Wailers",
	"Tom Petty and the Heartbreakers",
	"Kool & The Gang",
	"Sly & The Family Stone",
	"Of Monsters and Men"
];
var groupKey = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
var GROUP_RE = new RegExp(`(${GROUPS.map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})`, "gi");
/** Separa colaborações ("A & B", "A, B", "A feat. B") pra contar/comparar artistas individuais. Grupos conhecidos ficam inteiros. */
function splitArtists(name) {
	const kept = [];
	return name.replace(GROUP_RE, (m) => `\u0000${kept.push(m) - 1}\u0000`).split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bcom\b|\bwith\b)\s*/i).map((s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]).trim()).filter(Boolean);
}
/** O crédito ("A, B & C", "TOMORROW X TOGETHER", "MC A x MC B") inclui esse artista? Compara a frase inteira, não pedaços. */
function creditIncludes(credit, artist) {
	const a = groupKey(artist);
	if (!a) return false;
	if (splitArtists(credit).some((x) => groupKey(x) === a)) return true;
	return /\s(x|&|e|and|\+)\s|,/i.test(artist) && ` ${groupKey(credit)} `.includes(` ${a} `);
}
/** Título sem "(feat. X)", "[Ao Vivo]" e " - Remastered". */
var cleanTitle = (s) => s.replace(/\s*[([].*?[)\]]/g, "").replace(/\s+-\s+.*$/, "").trim();
var strip = (s) => cleanTitle(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, "");
/** Chave "música|primeiro artista" pra achar a mesma faixa em charts diferentes. */
var matchKey = (name, artist) => `${strip(name)}|${strip(splitArtists(artist)[0] ?? artist)}`;
//#endregion
//#region lib/sources/markets.ts
var markets = {
	br: {
		name: "Brasil",
		flag: "🇧🇷"
	},
	us: {
		name: "Estados Unidos",
		flag: "🇺🇸"
	},
	kr: {
		name: "Coreia do Sul",
		flag: "🇰🇷"
	},
	jp: {
		name: "Japão",
		flag: "🇯🇵"
	},
	gb: {
		name: "Reino Unido",
		flag: "🇬🇧"
	}
};
var globalMarket = {
	name: "Global",
	flag: "🌍"
};
/** "ap:br" → "Apple 🇧🇷"; "sp:global" → "Spotify 🌍". */
function marketLabel(m) {
	const [src, id] = m.split(":");
	const flag = id === "global" ? globalMarket.flag : markets[id]?.flag ?? id.toUpperCase();
	return `${src === "ap" ? "Apple" : "Spotify"} ${flag}`;
}
/** "ap:br" → "Apple Music Brasil"; "sp:global" → "Spotify Global". */
function marketName(m) {
	const [src, id] = m.split(":");
	return `${src === "ap" ? "Apple Music" : "Spotify"} ${id === "global" ? globalMarket.name : markets[id]?.name ?? id.toUpperCase()}`;
}
//#endregion
//#region lib/chart-hits.ts
/** Onde a música está agora: casa pelo id da fonte e, sem id, pelo nome + artista. */
function findHits(all, song) {
	const hits = [];
	for (const [cc, chart] of Object.entries(all.apple)) {
		const t = chart.tracks.find((x) => song.appleId && x.id === song.appleId || matchKey(x.name, x.artistName) === song.key);
		if (t) hits.push({
			market: `ap:${cc}`,
			label: marketLabel(`ap:${cc}`),
			rank: t.rank,
			change: chart.previousDate ? t.change : null,
			isNew: !!t.isNew,
			id: t.id,
			name: t.name,
			artist: t.artistName,
			artwork: t.artworkUrl100
		});
	}
	for (const [m, chart] of Object.entries(all.spotify)) {
		const e = chart.entries.find((x) => song.spotifyId && x.spotifyId === song.spotifyId || matchKey(x.trackName, x.artist) === song.key);
		if (e) hits.push({
			market: `sp:${m}`,
			label: marketLabel(`sp:${m}`),
			rank: e.rank,
			change: e.previousRank === null ? null : e.previousRank - e.rank,
			isNew: e.entryStatus ? e.entryStatus === "NEW_ENTRY" || e.entryStatus === "RE_ENTRY" : e.previousRank === null,
			streams: e.streams,
			id: e.spotifyId,
			name: e.trackName,
			artist: e.artist,
			artwork: e.artworkUrl ?? void 0
		});
	}
	return hits.sort((a, b) => a.rank - b.rank);
}
/** Faixas de um artista nos charts agora, agrupadas por música. */
function artistHits(all, artist) {
	const songs = /* @__PURE__ */ new Map();
	const add = (key, base, hit) => {
		const row = songs.get(key) ?? {
			key,
			...base,
			hits: []
		};
		row.artwork ??= base.artwork;
		row.appleId ??= base.appleId;
		row.spotifyId ??= base.spotifyId;
		row.hits.push(hit);
		songs.set(key, row);
	};
	for (const [cc, chart] of Object.entries(all.apple)) for (const t of chart.tracks) if (creditIncludes(t.artistName, artist)) add(matchKey(t.name, t.artistName), {
		name: t.name,
		artist: t.artistName,
		artwork: t.artworkUrl100,
		appleId: t.id
	}, {
		market: `ap:${cc}`,
		label: marketLabel(`ap:${cc}`),
		rank: t.rank,
		change: t.change,
		isNew: !!t.isNew,
		id: t.id,
		name: t.name,
		artist: t.artistName
	});
	for (const [m, chart] of Object.entries(all.spotify)) for (const e of chart.entries) if (creditIncludes(e.artist, artist)) add(matchKey(e.trackName, e.artist), {
		name: e.trackName,
		artist: e.artist,
		artwork: e.artworkUrl ?? void 0,
		spotifyId: e.spotifyId
	}, {
		market: `sp:${m}`,
		label: marketLabel(`sp:${m}`),
		rank: e.rank,
		change: e.previousRank === null ? null : e.previousRank - e.rank,
		isNew: e.previousRank === null,
		streams: e.streams,
		id: e.spotifyId,
		name: e.trackName,
		artist: e.artist
	});
	return [...songs.values()].map((s) => ({
		...s,
		hits: s.hits.sort((x, y) => x.rank - y.rank)
	})).sort((x, y) => x.hits[0].rank - y.hits[0].rank || y.hits.length - x.hits.length);
}
//#endregion
//#region lib/alerts.ts
var MILESTONES = [
	1e7,
	5e7,
	1e8,
	25e7,
	5e8,
	75e7,
	1e9,
	15e8,
	2e9,
	25e8,
	3e9,
	4e9,
	5e9
];
var milestoneLabel = (n) => n >= 1e9 ? `${String(n / 1e9).replace(".", ",")} bi` : `${n / 1e6} mi`;
var fid = (f) => `${f.kind}:${f.key}`;
function snapshotOf(all, f) {
	if (f.kind === "song") {
		const hits = findHits(all, {
			key: f.key,
			appleId: f.appleId,
			spotifyId: f.spotifyId
		});
		return {
			ranks: Object.fromEntries(hits.map((h) => [h.market, h.rank])),
			total: all.spotify.global?.entries.find((e) => hits.some((h) => h.market === "sp:global" && h.id === e.spotifyId))?.totalStreams ?? null
		};
	}
	const ranks = {};
	for (const s of artistHits(all, f.name)) for (const h of s.hits) ranks[`${s.key}|${h.market}`] = h.rank;
	return { ranks };
}
/**
* Compara a foto anterior com os charts de agora.
* Follow sem foto anterior só ganha a foto base (não dispara nada no primeiro dia).
*/
function computeAlerts(all, follows, prev, now = Date.now()) {
	const next = {};
	const alerts = [];
	for (const f of follows) {
		const id = fid(f);
		const cur = snapshotOf(all, f);
		next[id] = cur;
		const old = prev[id];
		if (!old) continue;
		const push = (a) => alerts.push({
			...a,
			id: `${id}|${a.kind}|${a.market ?? ""}|${now}`,
			at: now,
			follow: id
		});
		if (f.kind === "song") {
			const song = {
				key: f.key,
				name: f.name,
				artist: f.artist,
				artwork: f.artwork,
				spotifyId: f.spotifyId,
				appleId: f.appleId
			};
			for (const [m, rank] of Object.entries(cur.ranks)) {
				const before = old.ranks[m];
				if (rank === 1 && before !== 1) push({
					kind: "no1",
					title: `${f.name} chegou ao #1`,
					body: `${f.artist} no topo do ${marketName(m)}${before ? ` (antes #${before})` : ""}.`,
					song,
					market: m
				});
				else if (rank <= 10 && (before === void 0 || before > 10)) push({
					kind: "top10",
					title: `${f.name} entrou no top 10`,
					body: `#${rank} no ${marketName(m)}${before ? `, subiu de #${before}` : ""}.`,
					song,
					market: m
				});
				else if (before === void 0) push({
					kind: "entry",
					title: `${f.name} entrou num chart novo`,
					body: `Estreou em #${rank} no ${marketName(m)}.`,
					song,
					market: m
				});
			}
			for (const [m, before] of Object.entries(old.ranks)) if (cur.ranks[m] === void 0) push({
				kind: "left",
				title: `${f.name} saiu do ${marketLabel(m)}`,
				body: `Estava em #${before} no ${marketName(m)}.`,
				song,
				market: m
			});
			if (cur.total && old.total) {
				const passed = MILESTONES.filter((n) => old.total < n && cur.total >= n).pop();
				if (passed) push({
					kind: "milestone",
					title: `${f.name} passou de ${milestoneLabel(passed)} de streams`,
					body: `${f.artist} · total contado no Spotify Global.`,
					song,
					market: "sp:global"
				});
			}
		} else {
			const split = (k) => [k.slice(0, k.lastIndexOf("|")), k.slice(k.lastIndexOf("|") + 1)];
			const seenSongs = new Set(Object.keys(old.ranks).map((k) => split(k)[0]));
			const names = new Map(artistHits(all, f.name).map((s) => [s.key, s]));
			const done = /* @__PURE__ */ new Set();
			for (const [k, rank] of Object.entries(cur.ranks)) {
				const [songKey, m] = split(k);
				const s = names.get(songKey);
				if (!s) continue;
				const song = {
					key: s.key,
					name: s.name,
					artist: s.artist,
					artwork: s.artwork,
					spotifyId: s.spotifyId,
					appleId: s.appleId
				};
				if (rank === 1 && old.ranks[k] !== 1) push({
					kind: "artist-no1",
					title: `${f.name} no #1`,
					body: `${s.name} chegou ao topo do ${marketName(m)}.`,
					song,
					artist: f.name,
					market: m
				});
				else if (!seenSongs.has(songKey) && !done.has(songKey)) {
					done.add(songKey);
					push({
						kind: "artist-entry",
						title: `Música nova de ${f.name} nos charts`,
						body: `${s.name} estreou em #${rank} no ${marketName(m)}.`,
						song,
						artist: f.name,
						market: m
					});
				}
			}
		}
	}
	return {
		alerts,
		next
	};
}
//#endregion
//#region lib/daily.ts
/** Melhor posição de um follow (e em qual mercado) nos charts de agora, ou null se estiver fora de todos. */
function best(all, f) {
	const { ranks } = snapshotOf(all, f);
	let top = null;
	let charts = 0;
	const songs = /* @__PURE__ */ new Set();
	for (const [k, rank] of Object.entries(ranks)) {
		charts++;
		const market = f.kind === "artist" ? k.slice(k.lastIndexOf("|") + 1) : k;
		if (f.kind === "artist") songs.add(k.slice(0, k.lastIndexOf("|")));
		if (!top || rank < top.rank) top = {
			rank,
			market
		};
	}
	return top ? {
		...top,
		charts,
		songs: songs.size
	} : null;
}
/** Texto do push diário. Null quando ninguém que a pessoa segue está em chart nenhum (aí não manda nada). */
function dailySummary(all, follows) {
	const rows = follows.map((f) => ({
		f,
		b: best(all, f)
	})).filter((r) => !!r.b).sort((a, b) => a.b.rank - b.b.rank || a.f.name.localeCompare(b.f.name));
	if (!rows.length) return null;
	const line = ({ f, b }) => {
		const where = `#${b.rank} ${marketName(b.market)}`;
		return f.kind === "artist" && b.songs > 1 ? `${f.name}: ${b.songs} músicas, melhor ${where}` : `${f.name} ${where}`;
	};
	const shown = rows.slice(0, 3).map(line);
	const more = rows.length - shown.length;
	return {
		title: rows.length === 1 ? "Seu resumo do dia 🎧" : `${rows.length} dos seus estão nos charts hoje 🎧`,
		body: shown.join(" · ") + (more > 0 ? ` · +${more}` : ""),
		count: rows.length
	};
}
/** Data (AAAA-MM-DD) e hora em Brasília: o resumo sai de manhã no horário do Brasil, não do servidor. */
function brasiliaNow(now = Date.now()) {
	const d = /* @__PURE__ */ new Date(now - 3 * 36e5);
	return {
		date: d.toISOString().slice(0, 10),
		hour: d.getUTCHours()
	};
}
//#endregion
export { brasiliaNow, computeAlerts, dailySummary };
