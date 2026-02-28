'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cat, Dog, Edit2, PawPrint, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

type Species = 'dog' | 'cat' | 'other';

interface PetFormData {
  name: string;
  species: Species;
  breed: string;
  age: string;
}

interface PetData {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
}

const EMPTY_FORM: PetFormData = { name: '', species: 'dog', breed: '', age: '' };

function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  switch (species) {
    case 'dog':
      return <Dog className={className} />;
    case 'cat':
      return <Cat className={className} />;
    default:
      return <PawPrint className={className} />;
  }
}

function formatPetDetails(pet: PetData): string {
  const parts = [pet.species.charAt(0).toUpperCase() + pet.species.slice(1)];
  if (pet.breed) parts.push(pet.breed);
  if (pet.age != null) parts.push(`${pet.age} yr${pet.age !== 1 ? 's' : ''}`);
  return parts.join(' - ');
}

function SpeciesSelector({
  value,
  onChange,
}: {
  value: Species;
  onChange: (species: Species) => void;
}) {
  const options: { value: Species; label: string; icon: typeof Dog }[] = [
    { value: 'dog', label: 'Dog', icon: Dog },
    { value: 'cat', label: 'Cat', icon: Cat },
    { value: 'other', label: 'Other', icon: PawPrint },
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'flex items-center gap-1.5',
            value === opt.value && 'border-primary bg-primary/5 text-primary',
          )}
          onClick={() => onChange(opt.value)}
        >
          <opt.icon className="h-4 w-4" />
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function PetForm({
  initialData,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialData: PetFormData;
  onSubmit: (data: PetFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<PetFormData>(initialData);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <div className="space-y-2">
        <Label htmlFor="pet-name">Name</Label>
        <Input
          id="pet-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Pet name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Species</Label>
        <SpeciesSelector
          value={form.species}
          onChange={(species) => setForm({ ...form, species })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pet-breed">Breed</Label>
          <Input
            id="pet-breed"
            value={form.breed}
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
            placeholder="e.g., Labrador"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pet-age">Age</Label>
          <Input
            id="pet-age"
            type="number"
            min={0}
            max={50}
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder="Years"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || !form.name.trim()}>
          {isPending ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PetCard({
  pet,
  onEdit,
  onRemove,
  disabled,
}: {
  pet: PetData;
  onEdit: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-4">
      <div className="flex items-center gap-3">
        <SpeciesIcon species={pet.species} className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{pet.name}</p>
          <p className="text-xs text-muted-foreground">{formatPetDetails(pet)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={disabled}>
          <Edit2 className="h-4 w-4" />
          <span className="sr-only">Edit {pet.name}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove {pet.name}</span>
        </Button>
      </div>
    </div>
  );
}

function toPetFormData(pet: PetData): PetFormData {
  return {
    name: pet.name,
    species: pet.species as Species,
    breed: pet.breed ?? '',
    age: pet.age != null ? String(pet.age) : '',
  };
}

function parsePetFormData(data: PetFormData) {
  return {
    name: data.name.trim(),
    species: data.species,
    breed: data.breed.trim() || undefined,
    age: data.age ? Number.parseInt(data.age, 10) : undefined,
  };
}

export function PetsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: petsList, isLoading } = useQuery(trpc.owner.getPets.queryOptions());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);

  const invalidatePets = () => {
    queryClient.invalidateQueries({ queryKey: trpc.owner.getPets.queryKey() });
  };

  const addMutation = useMutation(
    trpc.owner.addPet.mutationOptions({
      onSuccess: () => {
        setShowAddForm(false);
        invalidatePets();
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.owner.updatePet.mutationOptions({
      onSuccess: () => {
        setEditingPetId(null);
        invalidatePets();
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.owner.removePet.mutationOptions({
      onSuccess: () => {
        invalidatePets();
      },
    }),
  );

  function handleAdd(data: PetFormData) {
    addMutation.mutate(parsePetFormData(data));
  }

  function handleUpdate(petId: string, data: PetFormData) {
    updateMutation.mutate({ petId, ...parsePetFormData(data) });
  }

  function handleRemove(petId: string, petName: string) {
    if (window.confirm(`Are you sure you want to remove ${petName}?`)) {
      removeMutation.mutate({ petId });
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasPets = petsList && petsList.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pets</CardTitle>
            <CardDescription>Manage your pet profiles.</CardDescription>
          </div>
          {!showAddForm && (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Pet
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddForm && (
          <PetForm
            initialData={EMPTY_FORM}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            isPending={addMutation.isPending}
            submitLabel="Add Pet"
          />
        )}

        {!hasPets && !showAddForm && (
          <p className="text-sm text-muted-foreground">
            No pets added yet. Click "Add Pet" to get started.
          </p>
        )}

        {hasPets &&
          petsList.map((pet) =>
            editingPetId === pet.id ? (
              <PetForm
                key={pet.id}
                initialData={toPetFormData(pet)}
                onSubmit={(data) => handleUpdate(pet.id, data)}
                onCancel={() => setEditingPetId(null)}
                isPending={updateMutation.isPending}
                submitLabel="Save"
              />
            ) : (
              <PetCard
                key={pet.id}
                pet={pet}
                onEdit={() => setEditingPetId(pet.id)}
                onRemove={() => handleRemove(pet.id, pet.name)}
                disabled={removeMutation.isPending}
              />
            ),
          )}
      </CardContent>
    </Card>
  );
}
