'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

export function StripeConnectSection() {
  const trpc = useTRPC();
  const { data: profile, isLoading, error } = useQuery(trpc.clinic.getProfile.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load Stripe Connect status.</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const isConnected = !!profile.stripeAccountId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Connect</CardTitle>
        <CardDescription>Your payment account for receiving payouts from FuzzyCat.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Status:</span>
          {isConnected ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>

        {isConnected && (
          <div className="text-sm text-muted-foreground">
            <span>Account ID: </span>
            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {profile.stripeAccountId}
            </code>
          </div>
        )}

        {isConnected ? (
          <Button variant="outline" asChild>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
              Open Stripe Dashboard
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to start receiving payouts. You will be redirected to
              Stripe to complete the setup.
            </p>
            <Button>Set Up Stripe Connect</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
