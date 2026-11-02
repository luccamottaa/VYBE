import {countries,loadChart,database} from '@/lib/chart';
export async function GET(request:Request) {
 const country=new URL(request.url).searchParams.get('country')||'br';
 if(!countries.includes(country)) return Response.json({error:'País inválido'},{status:400});
 try {
  const chart=await loadChart(country); let previous:any; let days=0;
  try {previous=await database()?.prepare('SELECT payload,date FROM chart_snapshots WHERE country=? AND date<? ORDER BY date DESC LIMIT 1').bind(country,chart.date).first();const count:any=await database()?.prepare('SELECT COUNT(*) AS n FROM chart_snapshots WHERE country=?').bind(country).first();days=count?.n||0;}catch{}
  const ranks=new Map(previous?JSON.parse(previous.payload).map((t:any)=>[t.id,t.rank]):[]);
  return Response.json({...chart,payload:undefined,days,previousDate:previous?.date||null,tracks:chart.tracks.map((t:any)=>({...t,change:ranks.has(t.id)?Number(ranks.get(t.id))-t.rank:null,isNew:!!previous&&!ranks.has(t.id)}))},{headers:{'Cache-Control':'private, max-age=60'}});
 }catch(e){return Response.json({error:(e as Error).message},{status:503});}
}
