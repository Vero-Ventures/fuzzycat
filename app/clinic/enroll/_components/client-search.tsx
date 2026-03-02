'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPC } from '@/lib/trpc/client';

export interface ClientResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  petName: string;
  pets: { id: string; name: string; species: string; breed: string | null }[];
}

interface ClientSearchProps {
  selectedClient: ClientResult | null;
  onSelect: (client: ClientResult) => void;
  onClear: () => void;
}

export function ClientSearch({ selectedClient, onSelect, onClear }: ClientSearchProps) {
  const trpc = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchResults = useQuery(
    trpc.clinic.searchClients.queryOptions(
      { query: debouncedQuery },
      { enabled: debouncedQuery.length >= 2 && !selectedClient },
    ),
  );

  if (selectedClient) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div>
          <p className="text-sm font-medium">{selectedClient.name}</p>
          <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onClear();
            setSearchQuery('');
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={searchRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        className="pl-9"
      />
      {showResults && debouncedQuery.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {searchResults.isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {searchResults.data?.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No existing clients found. Fill in the details below for a new client.
            </div>
          )}
          {searchResults.data?.map((client) => (
            <button
              key={client.id}
              type="button"
              className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onSelect(client)}
            >
              <div className="flex-1">
                <p className="font-medium">{client.name}</p>
                <p className="text-xs text-muted-foreground">{client.email}</p>
              </div>
              {client.pets.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {client.pets.map((p) => p.name).join(', ')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
