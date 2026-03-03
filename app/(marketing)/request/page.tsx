'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { submitClinicRequest } from './actions';

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
];

export default function RequestPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await submitClinicRequest(formData);

      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Request Submitted!</h1>
        <p className="mt-2 text-muted-foreground">
          We&apos;ll reach out to your clinic and let you know when FuzzyCat is available there.
          Thanks for your interest!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Request FuzzyCat at Your Clinic</h1>
        <p className="mt-3 text-muted-foreground">
          Want flexible payment plans at your vet? Tell us which clinic you visit and we&apos;ll
          reach out to them about offering FuzzyCat.
        </p>
      </div>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle>Your Information</CardTitle>
          <CardDescription>We&apos;ll notify you when your clinic joins FuzzyCat.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ownerEmail">Your Email *</Label>
              <Input
                id="ownerEmail"
                name="ownerEmail"
                type="email"
                required
                placeholder="you@example.com"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="ownerName">Your Name</Label>
              <Input
                id="ownerName"
                name="ownerName"
                type="text"
                placeholder="Jane Doe"
                className="mt-1.5"
              />
            </div>

            <Separator />

            <div>
              <Label htmlFor="clinicName">Clinic Name *</Label>
              <Input
                id="clinicName"
                name="clinicName"
                type="text"
                required
                placeholder="Happy Paws Veterinary"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="clinicCity">Clinic City</Label>
              <Input
                id="clinicCity"
                name="clinicCity"
                type="text"
                placeholder="Portland"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clinicState">State</Label>
                <select
                  id="clinicState"
                  name="clinicState"
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Select...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="clinicZip">ZIP Code</Label>
                <Input
                  id="clinicZip"
                  name="clinicZip"
                  type="text"
                  maxLength={10}
                  placeholder="97201"
                  className="mt-1.5"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
