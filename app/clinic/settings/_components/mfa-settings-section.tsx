'use client';

import { ExternalLink, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function MfaSettingsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multi-Factor Authentication
        </CardTitle>
        <CardDescription>
          MFA is required for all clinic accounts. Manage your authentication settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Multi-factor authentication adds an extra layer of security to your account. All clinic
          staff must have MFA enabled to access the clinic portal.
        </p>
        <Button variant="outline" asChild>
          <Link href="/mfa/setup">
            Manage MFA Settings
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
