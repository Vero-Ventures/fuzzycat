'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AccountSafetySection() {
  function handleDeactivate() {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate your account? This action cannot be undone.',
    );
    if (confirmed) {
      window.alert('Please contact support@fuzzycatapp.com to deactivate your account.');
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Account Safety
        </CardTitle>
        <CardDescription>
          Once you deactivate your account, there is no going back. Please be certain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={handleDeactivate}>
          Deactivate Account
        </Button>
      </CardContent>
    </Card>
  );
}
