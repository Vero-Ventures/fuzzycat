'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

interface ClinicProfile {
  name: string;
  phone: string;
  email: string;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string;
  addressZip: string;
}

interface FormFields {
  name: string;
  phone: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}

/** Compute changed fields between form state and saved profile. */
function getChangedFields(form: FormFields, profile: ClinicProfile): Record<string, string> {
  const updates: Record<string, string> = {};
  if (form.name !== profile.name) updates.name = form.name;
  if (form.phone !== profile.phone) updates.phone = form.phone;
  if (form.addressLine1 !== (profile.addressLine1 ?? '')) updates.addressLine1 = form.addressLine1;
  if (form.addressCity !== (profile.addressCity ?? '')) updates.addressCity = form.addressCity;
  if (form.addressState !== profile.addressState) updates.addressState = form.addressState;
  if (form.addressZip !== profile.addressZip) updates.addressZip = form.addressZip;
  return updates;
}

export function ClinicProfileForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error } = useQuery(trpc.clinic.getProfile.queryOptions());

  const [name, setName] = useState('');
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
      setPhone(profile.phone);
      setAddressLine1(profile.addressLine1 ?? '');
      setAddressCity(profile.addressCity ?? '');
      setAddressState(profile.addressState);
      setAddressZip(profile.addressZip);
    }
  }, [profile]);

  const updateMutation = useMutation(
    trpc.clinic.updateProfile.mutationOptions({
      onSuccess: () => {
        setSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: trpc.clinic.getProfile.queryKey() });
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

    const formFields: FormFields = {
      name,
      phone,
      addressLine1,
      addressCity,
      addressState,
      addressZip,
    };
    const updates = getChangedFields(formFields, profile);

    if (Object.keys(updates).length === 0) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }

    setSaveStatus('saving');
    updateMutation.mutate(updates);
  }

  if (isLoading) {
    return <ClinicProfileFormSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load clinic profile.</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const formFields: FormFields = {
    name,
    phone,
    addressLine1,
    addressCity,
    addressState,
    addressZip,
  };
  const hasChanges = Object.keys(getChangedFields(formFields, profile)).length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Clinic Information</CardTitle>
            <CardDescription>Update your clinic name, phone, and address.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <p className="text-sm text-green-600 dark:text-green-400">Saved!</p>
            )}
            {saveStatus === 'error' && <p className="text-sm text-destructive">Failed to save.</p>}
            <Button
              type="submit"
              form="clinic-profile-form"
              disabled={!hasChanges || saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="clinic-profile-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Logo upload placeholder */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">Clinic Logo</Label>
            <div className="mt-1.5 flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-8">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drag and drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-name" className="text-xs font-semibold uppercase tracking-wide">
              Clinic Name
            </Label>
            <Input
              id="clinic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your clinic name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-phone" className="text-xs font-semibold uppercase tracking-wide">
              Primary Phone
            </Label>
            <Input
              id="clinic-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-email" className="text-xs font-semibold uppercase tracking-wide">
              Clinic Email
            </Label>
            <Input id="clinic-email" type="email" value={profile.email} disabled />
            <p className="text-xs text-muted-foreground">
              Contact support to change your clinic email.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="clinic-address"
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Physical Address
            </Label>
            <Input
              id="clinic-address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main St"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="clinic-city"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                City
              </Label>
              <Input
                id="clinic-city"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="San Francisco"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="clinic-state"
                className="text-xs font-semibold uppercase tracking-wide"
              >
                State
              </Label>
              <Input
                id="clinic-state"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                placeholder="CA"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-zip" className="text-xs font-semibold uppercase tracking-wide">
                ZIP Code
              </Label>
              <Input
                id="clinic-zip"
                value={addressZip}
                onChange={(e) => setAddressZip(e.target.value)}
                placeholder="94102"
              />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClinicProfileFormSkeleton() {
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
        <Skeleton className="h-10 w-28" />
      </CardContent>
    </Card>
  );
}
