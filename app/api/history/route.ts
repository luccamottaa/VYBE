import {countries,database} from '@/lib/chart';
export async function GET(request:Request) {
 const p=new URL(request.url).searchParams;const country=p.get('country')||'br',id=p.get('id');
 if(!countries.includes(country)||!id||!/^\d{1,30}$/.test(id)) return Response.json({error:'Consulta inválida'},{status:400});
 try {const db=database();if(!db) throw new Error('Histórico indisponível');const rows=await db.prepare('SELECT date,payload FROM chart_snapshots WHERE country=? ORDER BY date DESC LIMIT 90').bind(country).all<{date:string,payload:string}>();
 const points=rows.results.reverse().map(r=>({date:r.date,rank:JSON.parse(r.payload).find((t:any)=>t.id===id)?.rank??null}));
 return Response.json({points});}catch{return Response.json({error:'Não foi possível carregar o histórico'},{status:503});}
}
