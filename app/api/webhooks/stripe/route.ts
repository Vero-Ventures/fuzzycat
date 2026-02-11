import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Implement Stripe webhook handler (#19)
  return NextResponse.json({ received: true });
}
