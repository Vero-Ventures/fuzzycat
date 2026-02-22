'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MAX_BILL_CENTS, MIN_BILL_CENTS } from '@/lib/constants';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents, toCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

const MIN_BILL_DOLLARS = MIN_BILL_CENTS / 100;
const MAX_BILL_DOLLARS = MAX_BILL_CENTS / 100;

export default function ClinicEnrollPage() {
  const trpc = useTRPC();

  // Fetch the clinic's own ID from their profile
  const profileQuery = useQuery(trpc.clinic.getProfile.queryOptions());
  const clinicId = profileQuery.data?.id;

  // Form state
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'debit_card' | 'bank_account'>('debit_card');
  const [billDollars, setBillDollars] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successPlanId, setSuccessPlanId] = useState<string | null>(null);

  const billAmountCents = useMemo(() => {
    const parsed = Number.parseFloat(billDollars);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return toCents(parsed);
  }, [billDollars]);

  const schedule = useMemo(() => {
    if (billAmountCents < MIN_BILL_CENTS) return null;
    try {
      return calculatePaymentSchedule(billAmountCents);
    } catch {
      return null;
    }
  }, [billAmountCents]);

  const createEnrollment = useMutation(
    trpc.enrollment.create.mutationOptions({
      onSuccess: (result) => {
        setSuccessPlanId(result.planId);
      },
      onError: (err) => {
        setError(err.message || 'Failed to create enrollment. Please try again.');
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clinicId) {
      setError('Clinic profile not loaded. Please try again.');
      return;
    }

    if (!ownerName.trim()) {
      setError('Owner name is required.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    if (!ownerPhone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (!petName.trim()) {
      setError('Pet name is required.');
      return;
    }
    if (billAmountCents < MIN_BILL_CENTS || billAmountCents > MAX_BILL_CENTS) {
      setError(
        `Bill amount must be between $${MIN_BILL_DOLLARS} and $${MAX_BILL_DOLLARS.toLocaleString()}.`,
      );
      return;
    }

    createEnrollment.mutate({
      clinicId,
      ownerData: {
        name: ownerName.trim(),
        email: ownerEmail.trim(),
        phone: ownerPhone.trim(),
        petName: petName.trim(),
        paymentMethod,
      },
      billAmountCents,
    });
  }

  // Success state
  if (successPlanId) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Enrollment Created</h1>
          <p className="mt-2 text-muted-foreground">
            The payment plan has been created successfully. The pet owner will receive an email with
            instructions to pay their deposit.
          </p>
        </div>

        {schedule && (
          <Card className="mb-6">
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="font-medium">{ownerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pet</p>
                  <p className="font-medium">{petName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vet Bill</p>
                  <p className="font-medium">{formatCents(schedule.totalBillCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total with Fee (6%)</p>
                  <p className="font-medium">{formatCents(schedule.totalWithFeeCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deposit (25%)</p>
                  <p className="font-medium">{formatCents(schedule.depositCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {schedule.numInstallments} Biweekly Installments
                  </p>
                  <p className="font-medium">{formatCents(schedule.installmentCents)} each</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/clinic/dashboard">Back to Dashboard</Link>
          </Button>
          <Button
            onClick={() => {
              setSuccessPlanId(null);
              setOwnerName('');
              setOwnerEmail('');
              setOwnerPhone('');
              setPetName('');
              setBillDollars('');
              setPaymentMethod('debit_card');
              setError(null);
            }}
          >
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (profileQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error loading profile
  if (profileQuery.isError || !clinicId) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load clinic profile</AlertTitle>
          <AlertDescription>Please try again or return to the dashboard.</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/clinic/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clinic/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Initiate Enrollment</CardTitle>
          <CardDescription>
            Create a new payment plan for a pet owner. They will receive an email with instructions
            to pay their deposit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Owner Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pet Owner Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Full Name</Label>
                  <Input
                    id="owner-name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-email">Email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="owner-phone">Phone</Label>
                  <Input
                    id="owner-phone"
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pet-name">Pet Name</Label>
                  <Input
                    id="pet-name"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="Whiskers"
                    required
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Method */}
            <div className="space-y-3">
              <Label>Payment Method</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={paymentMethod === 'debit_card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('debit_card')}
                >
                  Debit Card
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'bank_account' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('bank_account')}
                >
                  Bank Account
                </Button>
              </div>
            </div>

            <Separator />

            {/* Bill Amount */}
            <div className="space-y-2">
              <Label htmlFor="bill-amount">Vet Bill Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="bill-amount"
                  type="number"
                  min={MIN_BILL_DOLLARS}
                  max={MAX_BILL_DOLLARS}
                  step="0.01"
                  value={billDollars}
                  onChange={(e) => setBillDollars(e.target.value)}
                  placeholder={`${MIN_BILL_DOLLARS}`}
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Between ${MIN_BILL_DOLLARS.toLocaleString()} and $
                {MAX_BILL_DOLLARS.toLocaleString()}
              </p>
            </div>

            {/* Payment Preview */}
            {schedule && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <h3 className="text-sm font-medium">Payment Plan Preview</h3>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div className="flex justify-between md:flex-col">
                    <span className="text-muted-foreground">Platform Fee (6%)</span>
                    <span className="font-medium">{formatCents(schedule.feeCents)}</span>
                  </div>
                  <div className="flex justify-between md:flex-col">
                    <span className="text-muted-foreground">Total with Fee</span>
                    <span className="font-medium">{formatCents(schedule.totalWithFeeCents)}</span>
                  </div>
                  <div className="flex justify-between md:flex-col">
                    <span className="text-muted-foreground">Deposit (25%)</span>
                    <span className="font-medium">{formatCents(schedule.depositCents)}</span>
                  </div>
                  <div className="flex justify-between md:flex-col">
                    <span className="text-muted-foreground">
                      {schedule.numInstallments} Installments
                    </span>
                    <span className="font-medium">
                      {formatCents(schedule.installmentCents)} each
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createEnrollment.isPending}
            >
              {createEnrollment.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Enrollment...
                </>
              ) : (
                'Create Payment Plan'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
