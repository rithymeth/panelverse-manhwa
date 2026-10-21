import {NextRequest,NextResponse} from 'next/server';
import {cookieName,validOrigin} from '@/lib/auth';
export async function POST(req:NextRequest){if(!validOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});const res=NextResponse.json({ok:true});res.cookies.set(cookieName,'',{path:'/',maxAge:0});return res;}
