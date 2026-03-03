'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTRPC } from '@/lib/trpc/client';
import { OwnerInfoSheet } from './_components/owner-info-sheet';
import { QuickReferenceCard } from './_components/quick-reference-card';
import { WaitingRoomFlyer } from './_components/waiting-room-flyer';

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState('flyer');
  const trpc = useTRPC();
  const { data: profile } = useQuery(trpc.clinic.getProfile.queryOptions());

  const clinicName = profile?.name ?? 'Your Clinic';
  const clinicId = profile?.id ?? '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Front-Desk Materials</h1>
          <p className="mt-1 text-muted-foreground">
            Print materials for your waiting room and front desk staff.
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <Separator className="my-6" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flyer">Waiting Room Flyer</TabsTrigger>
          <TabsTrigger value="reference">Staff Quick Reference</TabsTrigger>
          <TabsTrigger value="info">Pet Owner Info Sheet</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="flyer">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Waiting Room Flyer
                </CardTitle>
                <CardDescription>
                  Place this in your waiting room to let pet owners know about payment plan options.
                  Includes a QR code linking to your enrollment page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WaitingRoomFlyer clinicName={clinicName} clinicId={clinicId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reference">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Front Desk Quick Reference
                </CardTitle>
                <CardDescription>
                  Give this to your front desk staff so they can explain FuzzyCat payment plans to
                  pet owners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuickReferenceCard clinicName={clinicName} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pet Owner Info Sheet
                </CardTitle>
                <CardDescription>
                  A handout for pet owners explaining how payment plans work, with a cost example.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OwnerInfoSheet clinicName={clinicName} />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-material,
          .print-material * {
            visibility: visible;
          }
          .print-material {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
