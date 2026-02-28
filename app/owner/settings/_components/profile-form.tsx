'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

interface ProfileUpdates {
  name?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

/** Compare form values to the loaded profile and return only changed fields. */
function buildProfileDiff(
  form: {
    name: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
  },
  profile: {
    name: string;
    email: string;
    phone: string;
    addressLine1: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  },
): ProfileUpdates {
  const updates: ProfileUpdates = {};
  if (form.name !== profile.name) updates.name = form.name;
  if (form.email !== profile.email) updates.email = form.email;
  if (form.phone !== profile.phone) updates.phone = form.phone;
  if (form.addressLine1 !== (profile.addressLine1 ?? '')) updates.addressLine1 = form.addressLine1;
  if (form.addressCity !== (profile.addressCity ?? '')) updates.addressCity = form.addressCity;
  if (form.addressState !== (profile.addressState ?? '')) updates.addressState = form.addressState;
  if (form.addressZip !== (profile.addressZip ?? '')) updates.addressZip = form.addressZip;
  return updates;
}

export function ProfileForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error } = useQuery(trpc.owner.getProfile.queryOptions());

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
      setAddressLine1(profile.addressLine1 ?? '');
      setAddressCity(profile.addressCity ?? '');
      setAddressState(profile.addressState ?? '');
      setAddressZip(profile.addressZip ?? '');
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

    const formValues = { name, email, phone, addressLine1, addressCity, addressState, addressZip };
    const updates = buildProfileDiff(formValues, profile);

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

  const formValues = { name, email, phone, addressLine1, addressCity, addressState, addressZip };
  const hasChanges = Object.keys(buildProfileDiff(formValues, profile)).length > 0;

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
              placeholder="+15551234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Street Address</Label>
            <Input
              id="addressLine1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="addressCity">City</Label>
              <Input
                id="addressCity"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Anytown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressState">State</Label>
              <Input
                id="addressState"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                placeholder="CA"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressZip">ZIP Code</Label>
              <Input
                id="addressZip"
                value={addressZip}
                onChange={(e) => setAddressZip(e.target.value)}
                placeholder="90210"
              />
            </div>
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-28" />
      </CardContent>
    </Card>
  );
}
