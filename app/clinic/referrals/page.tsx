'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Megaphone, Send } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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

interface ReferralRow {
  id: string;
  referredEmail: string;
  status: string;
  createdAt: Date | null;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'converted':
      return <Badge variant="default">Converted</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expired</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

export default function ClinicReferralsPage() {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: codeData } = useQuery(trpc.growth.getMyReferralCode.queryOptions());
  const { data: referrals } = useQuery(trpc.growth.getMyClinicReferrals.queryOptions());

  const createReferral = useMutation(
    trpc.growth.createClinicReferral.mutationOptions({
      onSuccess: () => {
        setEmail('');
        queryClient.invalidateQueries({
          queryKey: trpc.growth.getMyClinicReferrals.queryKey(),
        });
      },
    }),
  );

  const handleCopy = () => {
    if (codeData?.shareUrl) {
      navigator.clipboard.writeText(codeData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      createReferral.mutate({ referredEmail: email.trim() });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Referrals</h1>
        <p className="mt-1 text-muted-foreground">
          Invite fellow clinics to FuzzyCat and earn a +2% revenue share bonus for 6 months per
          converted referral.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {/* Referral code + share link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link with other veterinary clinics. When they sign up, you both benefit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {codeData && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
                    {codeData.shareUrl}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Referral code: <strong>{codeData.code}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite by email */}
        <Card>
          <CardHeader>
            <CardTitle>Invite a Clinic</CardTitle>
            <CardDescription>
              Enter a clinic contact&apos;s email address and we&apos;ll include your referral code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="clinic@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={createReferral.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {createReferral.isPending ? 'Sending...' : 'Invite'}
              </Button>
            </form>
            {createReferral.error && (
              <p className="mt-2 text-sm text-destructive">{createReferral.error.message}</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Referral history */}
        <Card>
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            {!referrals || referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No referrals yet. Share your link to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((ref: ReferralRow) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium">{ref.referredEmail}</TableCell>
                      <TableCell>
                        <StatusBadge status={ref.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ref.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
