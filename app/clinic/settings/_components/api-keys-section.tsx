'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/lib/trpc/client';

const ALL_PERMISSIONS = [
  { value: 'enrollments:read', label: 'Enrollments (read)' },
  { value: 'enrollments:write', label: 'Enrollments (write)' },
  { value: 'clinic:read', label: 'Clinic (read)' },
  { value: 'clinic:write', label: 'Clinic (write)' },
  { value: 'clients:read', label: 'Clients (read)' },
  { value: 'export:read', label: 'Export (read)' },
  { value: 'payouts:read', label: 'Payouts (read)' },
] as const;

type Permission = (typeof ALL_PERMISSIONS)[number]['value'];

export function ApiKeysSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set());
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiKeys, isLoading } = useQuery(trpc.clinic.listApiKeys.queryOptions());

  const createMutation = useMutation(
    trpc.clinic.createApiKey.mutationOptions({
      onSuccess: (data) => {
        setNewKey(data.plaintextKey);
        setShowCreate(false);
        setKeyName('');
        setSelectedPerms(new Set());
        queryClient.invalidateQueries({ queryKey: trpc.clinic.listApiKeys.queryKey() });
      },
    }),
  );

  const revokeMutation = useMutation(
    trpc.clinic.revokeApiKey.mutationOptions({
      onSuccess: () => {
        setRevokeId(null);
        queryClient.invalidateQueries({ queryKey: trpc.clinic.listApiKeys.queryKey() });
      },
    }),
  );

  function togglePerm(perm: Permission) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  }

  function handleCreate() {
    if (!keyName.trim() || selectedPerms.size === 0) return;
    createMutation.mutate({
      name: keyName.trim(),
      permissions: [...selectedPerms],
    });
  }

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = apiKeys?.filter((k) => !k.revokedAt) ?? [];
  const revokedKeys = apiKeys?.filter((k) => k.revokedAt) ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage API keys for external POS integrations. Keys provide programmatic access to
              your clinic data.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="mr-1 h-4 w-4" />
            Create Key
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Create form */}
          {showCreate && (
            <div className="rounded-lg border p-4 space-y-3">
              <Input
                placeholder="Key name (e.g., POS Integration)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
              <div>
                <p className="text-sm font-medium mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <button
                      key={perm.value}
                      type="button"
                      onClick={() => togglePerm(perm.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selectedPerms.has(perm.value)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {perm.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!keyName.trim() || selectedPerms.size === 0 || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* Newly created key display */}
          {newKey && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Copy your API key now. It won't be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-amber-100 px-3 py-2 font-mono text-xs dark:bg-amber-900">
                  {newKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1 h-3 w-3" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKey(null)}>
                Dismiss
              </Button>
            </div>
          )}

          {/* Active keys */}
          {activeKeys.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No API keys yet. Create one to get started with the REST API.
            </p>
          )}

          {activeKeys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{key.name}</span>
                  <code className="text-xs text-muted-foreground">{key.keyPrefix}...</code>
                </div>
                <div className="flex flex-wrap gap-1">
                  {key.permissions.map((perm) => (
                    <Badge key={perm} variant="secondary" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'unknown'}
                  {key.lastUsedAt
                    ? ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : ' · Never used'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRevokeId(key.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Revoked keys (collapsed) */}
          {revokedKeys.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {revokedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center gap-2 rounded-lg border p-3 opacity-50"
                  >
                    <span className="text-sm line-through">{key.name}</span>
                    <code className="text-xs text-muted-foreground">{key.keyPrefix}...</code>
                    <Badge variant="outline" className="text-xs">
                      Revoked
                    </Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke the API key. Any integrations using this key will stop
              working. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeId) {
                  revokeMutation.mutate({ apiKeyId: revokeId });
                }
              }}
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
