'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

const STAGE_LABELS: Record<string, string> = {
  day_1_reminder: 'Day 1 Reminder',
  day_7_followup: 'Day 7 Follow-up',
  day_14_final: 'Day 14 Final',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function getStageBadgeVariant(stage: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (stage) {
    case 'day_7_followup':
      return 'default';
    case 'day_14_final':
      return 'destructive';
    case 'completed':
    case 'cancelled':
      return 'outline';
    default:
      return 'secondary';
  }
}

// ── Extracted row components to reduce cognitive complexity ──────────

interface CollectionItem {
  id: string;
  planId: string;
  stage: string;
  startedAt: unknown;
  lastEscalatedAt: unknown;
  nextEscalationAt: unknown;
  notes: string | null;
  createdAt: unknown;
  ownerName: string | null;
  ownerEmail: string | null;
  petName: string | null;
  clinicName: string | null;
  remainingCents: number | null;
}

function CollectionOwnerCell({ collection }: { collection: CollectionItem }) {
  return (
    <TableCell>
      <div>
        <span className="font-medium">{collection.ownerName ?? 'Unknown'}</span>
        {collection.ownerEmail && (
          <p className="text-xs text-muted-foreground">{collection.ownerEmail}</p>
        )}
      </div>
    </TableCell>
  );
}

function CollectionStageCell({ stage }: { stage: string }) {
  return (
    <TableCell>
      <Badge variant={getStageBadgeVariant(stage)}>{STAGE_LABELS[stage] ?? stage}</Badge>
    </TableCell>
  );
}

function CancelActionInline({
  cancelReason,
  setCancelReason,
  onConfirm,
  onCancel,
  isPending,
}: {
  cancelReason: string;
  setCancelReason: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Reason..."
        value={cancelReason}
        onChange={(e) => setCancelReason(e.target.value)}
        className="h-8 w-32 text-xs"
      />
      <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isPending}>
        {isPending ? '...' : 'Confirm'}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        X
      </Button>
    </div>
  );
}

function CollectionActionCell({
  collection,
  cancellingId,
  setCancellingId,
  cancelReason,
  setCancelReason,
  onCancelConfirm,
  isPending,
}: {
  collection: CollectionItem;
  cancellingId: string | null;
  setCancellingId: (id: string | null) => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  onCancelConfirm: (collectionId: string) => void;
  isPending: boolean;
}) {
  const isTerminal = collection.stage === 'completed' || collection.stage === 'cancelled';

  if (isTerminal) {
    return (
      <TableCell>
        <span className="text-xs text-muted-foreground">{collection.notes ?? '--'}</span>
      </TableCell>
    );
  }

  if (cancellingId === collection.id) {
    return (
      <TableCell>
        <CancelActionInline
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          onConfirm={() => onCancelConfirm(collection.id)}
          onCancel={() => {
            setCancellingId(null);
            setCancelReason('');
          }}
          isPending={isPending}
        />
      </TableCell>
    );
  }

  return (
    <TableCell>
      <Button size="sm" variant="outline" onClick={() => setCancellingId(collection.id)}>
        Cancel
      </Button>
    </TableCell>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function SoftCollectionsList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const limit = 20;

  const { data, isLoading, error } = useQuery(
    trpc.admin.getSoftCollections.queryOptions({ limit, offset }),
  );

  const cancelMutation = useMutation(
    trpc.admin.cancelSoftCollection.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.admin.getSoftCollections.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.admin.getSoftCollectionStats.queryKey() });
        setCancellingId(null);
        setCancelReason('');
      },
    }),
  );

  const handleCancelConfirm = (collectionId: string) => {
    cancelMutation.mutate({
      collectionId,
      reason: cancelReason || 'Cancelled by admin',
    });
  };

  const totalCount = data?.pagination.totalCount ?? 0;
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soft Collections</CardTitle>
        <CardDescription>
          Post-default recovery workflow. Friendly reminders sent to pet owners.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SoftCollectionsSkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load soft collections.
          </p>
        ) : !data || data.collections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No soft collections. No plans are currently in the recovery workflow.
          </p>
        ) : (
          <>
            <SoftCollectionsTable
              collections={data.collections}
              cancellingId={cancellingId}
              setCancellingId={setCancellingId}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              onCancelConfirm={handleCancelConfirm}
              isPending={cancelMutation.isPending}
            />
            {totalCount > limit && (
              <SoftCollectionsPagination
                offset={offset}
                limit={limit}
                totalCount={totalCount}
                hasNextPage={hasNextPage}
                hasPrevPage={hasPrevPage}
                onNext={() => setOffset(offset + limit)}
                onPrev={() => setOffset(Math.max(0, offset - limit))}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SoftCollectionsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function SoftCollectionsTable({
  collections,
  cancellingId,
  setCancellingId,
  cancelReason,
  setCancelReason,
  onCancelConfirm,
  isPending,
}: {
  collections: CollectionItem[];
  cancellingId: string | null;
  setCancellingId: (id: string | null) => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  onCancelConfirm: (collectionId: string) => void;
  isPending: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Owner</TableHead>
          <TableHead>Pet</TableHead>
          <TableHead>Clinic</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Next Escalation</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {collections.map((collection) => (
          <TableRow key={collection.id}>
            <CollectionOwnerCell collection={collection} />
            <TableCell>{collection.petName ?? '--'}</TableCell>
            <TableCell>{collection.clinicName ?? 'Unknown'}</TableCell>
            <TableCell className="font-medium text-destructive">
              {collection.remainingCents != null ? formatCents(collection.remainingCents) : '--'}
            </TableCell>
            <CollectionStageCell stage={collection.stage} />
            <TableCell className="text-muted-foreground">
              {collection.nextEscalationAt ? formatDate(collection.nextEscalationAt as Date) : '--'}
            </TableCell>
            <CollectionActionCell
              collection={collection}
              cancellingId={cancellingId}
              setCancellingId={setCancellingId}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              onCancelConfirm={onCancelConfirm}
              isPending={isPending}
            />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SoftCollectionsPagination({
  offset,
  limit,
  totalCount,
  hasNextPage,
  hasPrevPage,
  onNext,
  onPrev,
}: {
  offset: number;
  limit: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {offset + 1}--{Math.min(offset + limit, totalCount)} of {totalCount}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onPrev} disabled={!hasPrevPage}>
          Previous
        </Button>
        <Button size="sm" variant="outline" onClick={onNext} disabled={!hasNextPage}>
          Next
        </Button>
      </div>
    </div>
  );
}
