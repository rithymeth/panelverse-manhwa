import {NextRequest,NextResponse} from 'next/server';
import {createSession,cookieName,cookieOptions,passwordMatches,validOrigin} from '@/lib/auth';
export const runtime='nodejs';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(request:NextRequest){
  if(!validOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const current=attempts.get(ip); if(current&&current.until>Date.now()&&current.count>=8)return NextResponse.json({error:'Too many attempts. Try again later.'},{status:429});
  let password='';try{const body=await request.json();password=String(body.password||'');}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  if(!passwordMatches(password)){
    const next=(current&&current.until>Date.now()?current.count:0)+1; attempts.set(ip,{count:next,until:Date.now()+15*60_000});
    return NextResponse.json({error:'Incorrect password'},{status:401});
  }
  attempts.delete(ip); const response=NextResponse.json({ok:true});response.cookies.set(cookieName,createSession(),cookieOptions());return response;
}
