import { cookies, headers } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
const cookieName = 'panelverse_admin';
function signingKey() { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) return null; return s; }
function mac(payload: string) { const key=signingKey(); return key ? createHmac('sha256',key).update(payload).digest('hex') : ''; }
export function isValidSession(token: string | undefined) {
  if (!token || !signingKey()) return false;
  const parts = token.split('.');
  if(parts.length!==2 || !/^\d+$/.test(parts[0]) || !/^[0-9a-f]{64}$/.test(parts[1])) return false;
  const actual=Buffer.from(parts[1],'hex'), expected=Buffer.from(mac(parts[0]),'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected) && Number(parts[0])>Date.now() && Number(parts[0])<Date.now()+86400001;
}
export async function isAdmin() {return isValidSession((await cookies()).get(cookieName)?.value);}
export function requestIsAdmin(request: NextRequest){return isValidSession(request.cookies.get(cookieName)?.value);}
export function passwordMatches(password:string) {
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected || expected.length<12 || password.length>512) return false;
  const aa=Buffer.from(expected),bb=Buffer.from(password); return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export function createSession(){const exp=String(Date.now()+24*60*60*1000);return `${exp}.${mac(exp)}`;}
export function cookieOptions(){return {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax' as const, path:'/', maxAge:24*60*60};}
export function validOrigin(request: NextRequest) {
  const origin=request.headers.get('origin'); if(!origin) return false;
  try {return new URL(origin).host===request.headers.get('host');} catch {return false;}
}
export function unauthorized(){ return Response.json({error:'Not authorized'}, {status:401}); }
export function forbidden(){ return Response.json({error:'Invalid origin'}, {status:403}); }
export {cookieName};
