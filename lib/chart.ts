import { env } from 'cloudflare:workers';
import br from './data/br.json';
import us from './data/us.json';
export const countries = ['br','us','kr','jp','gb'];
export type Track = {id:string;name:string;artistName:string;artworkUrl100:string;url:string; rank:number};
export function database(): D1Database | undefined { return (env as unknown as {DB?:D1Database}).DB; }
export function normalize(feed:any): Track[] {
 if (!Array.isArray(feed?.results) || !feed.results.length) throw new Error('Resposta inválida');
 return feed.results.slice(0,100).map((t:any,i:number)=>({id:String(t.id), name:String(t.name),artistName:String(t.artistName),artworkUrl100:String(t.artworkUrl100),url:String(t.url),rank:i+1}));
}
export async function loadChart(country:string) {
 const db=database(); let cached:any; let historyAvailable=!!db;
 try { cached=await db?.prepare('SELECT * FROM chart_snapshots WHERE country=? ORDER BY date DESC LIMIT 1').bind(country).first(); } catch {historyAvailable=false;}
 if(cached && Date.now()-cached.fetched<3600000) return {...cached,tracks:JSON.parse(cached.payload),stale:false,historyAvailable};
 try {
  const response=await fetch(`https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`,{signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error('Fonte indisponível');
  const {feed}=await response.json() as any; const tracks=normalize(feed); const fetched=Date.now();
  const updated=String(feed.updated); const date=new Date(updated).toISOString().slice(0,10);
  try {await db?.prepare('INSERT INTO chart_snapshots (country,date,fetched,updated,payload) VALUES (?,?,?,?,?) ON CONFLICT(country,date) DO UPDATE SET fetched=excluded.fetched,updated=excluded.updated,payload=excluded.payload').bind(country,date,fetched,updated,JSON.stringify(tracks)).run();} catch{historyAvailable=false;}
  return {country,date,fetched,updated,tracks,stale:false,historyAvailable};
 } catch {
  if(cached) return {...cached,tracks:JSON.parse(cached.payload),stale:true,historyAvailable};
  const seed=country==='br'?br:country==='us'?us:null;
  if(seed) return {country,date:new Date(seed.feed.updated).toISOString().slice(0,10),updated:seed.feed.updated,tracks:normalize(seed.feed),stale:true,historyAvailable:false};
  throw new Error('Não foi possível consultar este país. Tente novamente.');
 }
}
