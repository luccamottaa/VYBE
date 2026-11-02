import { env } from 'cloudflare:workers';
import br from './data/br.json';
import us from './data/us.json';
import { countries, fetchAppleChart, normalize, type AppleTrack } from './sources/apple.ts';
export { countries, normalize };
export type Track = AppleTrack;
export function database(): D1Database | undefined { return (env as unknown as {DB?:D1Database}).DB; }
export async function loadChart(country:string) {
 const db=database(); let cached:any; let historyAvailable=!!db;
 try { cached=await db?.prepare('SELECT * FROM chart_snapshots WHERE country=? ORDER BY date DESC LIMIT 1').bind(country).first(); } catch {historyAvailable=false;}
 if(cached && Date.now()-cached.fetched<3600000) return {...cached,tracks:JSON.parse(cached.payload),stale:false,historyAvailable};
 try {
  const {date,updated,tracks}=await fetchAppleChart(country); const fetched=Date.now();
  try {await db?.prepare('INSERT INTO chart_snapshots (country,date,fetched,updated,payload) VALUES (?,?,?,?,?) ON CONFLICT(country,date) DO UPDATE SET fetched=excluded.fetched,updated=excluded.updated,payload=excluded.payload').bind(country,date,fetched,updated,JSON.stringify(tracks)).run();} catch{historyAvailable=false;}
  return {country,date,fetched,updated,tracks,stale:false,historyAvailable};
 } catch {
  if(cached) return {...cached,tracks:JSON.parse(cached.payload),stale:true,historyAvailable};
  const seed=country==='br'?br:country==='us'?us:null;
  if(seed) return {country,date:new Date(seed.feed.updated).toISOString().slice(0,10),updated:seed.feed.updated,tracks:normalize(seed.feed),stale:true,historyAvailable:false};
  throw new Error('Não foi possível consultar este país. Tente novamente.');
 }
}
