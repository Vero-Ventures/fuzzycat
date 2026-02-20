import { NextResponse } from 'next/server';

export async function POST() {
  // Plaid webhook validation not yet implemented (#20).
  // Return 501 to reject all requests until integration is built.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
