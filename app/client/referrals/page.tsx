'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Gift } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatCents } from '@/lib/utils/money';

interface ClientReferralRow {
  id: string;
  referralCode: string;
  status: string;
  creditApplied: boolean;
  convertedAt: Date | null;
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

export default function ClientReferralsPage() {
  const [copied, setCopied] = useState(false);
  const trpc = useTRPC();

  const { data: codeData } = useQuery(trpc.growth.getMyClientReferralCode.queryOptions());
  const { data: referrals } = useQuery(trpc.growth.getMyClientReferrals.queryOptions());

  const handleCopy = () => {
    if (codeData?.shareUrl) {
      navigator.clipboard.writeText(codeData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Refer a Friend</h1>
        <p className="mt-1 text-muted-foreground">
          Share FuzzyCat with other pet parents. You both save on platform fees.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              How Referrals Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {codeData ? formatCents(codeData.discountAmount) : '$20'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your friend saves on their platform fee
                </p>
              </div>
              <div className="rounded-md border p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {codeData ? formatCents(codeData.creditAmount) : '$20'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You get off your next payment plan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share link */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referral Link</CardTitle>
            <CardDescription>
              Share this link with friends who have pets. When they sign up and create a payment
              plan, you both benefit.
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

        <Separator />

        {/* Referral history */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {!referrals || referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No referrals yet. Share your link to get started!
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((ref: ClientReferralRow) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-mono text-sm">{ref.referralCode}</TableCell>
                      <TableCell>
                        <StatusBadge status={ref.status} />
                      </TableCell>
                      <TableCell>
                        {ref.creditApplied ? (
                          <Badge variant="default">Applied</Badge>
                        ) : ref.status === 'converted' ? (
                          <span className="text-sm text-muted-foreground">Pending</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        )}
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
