'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

export function ProfileForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error } = useQuery(trpc.owner.getProfile.queryOptions());

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
    }
  }, [profile]);

  const updateMutation = useMutation(
    trpc.owner.updateProfile.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: trpc.owner.getProfile.queryKey() });
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: () => {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    const updates: { name?: string; email?: string; phone?: string } = {};
    if (name !== profile.name) updates.name = name;
    if (email !== profile.email) updates.email = email;
    if (phone !== profile.phone) updates.phone = phone;

    if (Object.keys(updates).length === 0) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }

    setSaveStatus('saving');
    updateMutation.mutate(updates);
  }

  if (isLoading) {
    return <ProfileFormSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load profile information.</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const hasChanges = name !== profile.name || email !== profile.email || phone !== profile.phone;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!hasChanges || saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>
            {saveStatus === 'saved' && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Profile updated successfully.
              </p>
            )}
            {saveStatus === 'error' && (
              <p className="text-sm text-destructive">
                Failed to update profile. Please try again.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-28" />
      </CardContent>
    </Card>
  );
}
