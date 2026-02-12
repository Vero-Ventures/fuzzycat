import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Implement Plaid webhook handler (#20)
  return NextResponse.json({ received: true });
}
