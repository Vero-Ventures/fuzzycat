'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTRPC } from '@/lib/trpc/client';
import type { EnrollmentData } from './types';

interface StepClinicSelectionProps {
  data: EnrollmentData;
  updateData: (updates: Partial<EnrollmentData>) => void;
  onNext: () => void;
}

export function StepClinicSelection({ data, updateData, onNext }: StepClinicSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const trpc = useTRPC();

  const clinicSearch = useQuery(
    trpc.clinic.search.queryOptions({ query: searchQuery }, { enabled: searchQuery.length >= 2 }),
  );

  const clinics = clinicSearch.data ?? [];
  const isSelected = data.clinicId.length > 0;

  function handleSelectClinic(clinic: { id: string; name: string }) {
    updateData({ clinicId: clinic.id, clinicName: clinic.name });
  }

  function handleContinue() {
    if (isSelected) {
      onNext();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Your Veterinary Clinic</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search for the clinic where you received care. Only registered clinics are shown.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="clinic-search">Search by clinic name or city</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="clinic-search"
            placeholder="e.g. Happy Paws Veterinary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <div className="space-y-2">
          {clinicSearch.isLoading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Searching clinics...</p>
          )}
          {clinicSearch.isError && (
            <p className="py-4 text-center text-sm text-destructive">
              Failed to search clinics. Please try again.
            </p>
          )}
          {!clinicSearch.isLoading && clinics.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No clinics found matching &quot;{searchQuery}&quot;. Please check the name and try
              again.
            </p>
          )}
          {clinics.length > 0 && (
            <ul className="divide-y rounded-md border">
              {clinics.map((clinic) => (
                <li key={clinic.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectClinic(clinic)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent ${
                      data.clinicId === clinic.id ? 'bg-accent' : ''
                    }`}
                  >
                    <p className="font-medium">{clinic.name}</p>
                    {(clinic.addressCity || clinic.addressState) && (
                      <p className="text-sm text-muted-foreground">
                        {[clinic.addressCity, clinic.addressState].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Selected clinic display */}
      {isSelected && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">Selected clinic</p>
          <p className="text-lg font-semibold">{data.clinicName}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!isSelected} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
