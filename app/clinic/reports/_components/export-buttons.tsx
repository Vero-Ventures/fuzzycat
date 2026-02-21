'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/lib/trpc/client';

/**
 * Trigger a browser download of a CSV string.
 */
function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButtons() {
  const trpc = useTRPC();
  const [activeExport, setActiveExport] = useState<string | null>(null);

  // Build date range for revenue export (last 12 months)
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const fromISO = twelveMonthsAgo.toISOString();
  const toISO = now.toISOString();

  // Use lazy queries - only fetch when button is clicked
  const clientsQuery = useQuery({
    ...trpc.clinic.exportClientsCSV.queryOptions(),
    enabled: activeExport === 'clients',
  });

  const revenueQuery = useQuery({
    ...trpc.clinic.exportRevenueCSV.queryOptions({
      dateFrom: fromISO,
      dateTo: toISO,
    }),
    enabled: activeExport === 'revenue',
  });

  const payoutsQuery = useQuery({
    ...trpc.clinic.exportPayoutsCSV.queryOptions(),
    enabled: activeExport === 'payouts',
  });

  // Handle download when data arrives
  const handleExport = useCallback(
    (type: string) => {
      if (type === 'clients' && clientsQuery.data) {
        downloadCsv(clientsQuery.data.csv, 'clients-export.csv');
        setActiveExport(null);
        return;
      }
      if (type === 'revenue' && revenueQuery.data) {
        downloadCsv(revenueQuery.data.csv, 'revenue-export.csv');
        setActiveExport(null);
        return;
      }
      if (type === 'payouts' && payoutsQuery.data) {
        downloadCsv(payoutsQuery.data.csv, 'payouts-export.csv');
        setActiveExport(null);
        return;
      }
      setActiveExport(type);
    },
    [clientsQuery.data, revenueQuery.data, payoutsQuery.data],
  );

  // Auto-download when data arrives
  if (activeExport === 'clients' && clientsQuery.data) {
    downloadCsv(clientsQuery.data.csv, 'clients-export.csv');
    setActiveExport(null);
  }
  if (activeExport === 'revenue' && revenueQuery.data) {
    downloadCsv(revenueQuery.data.csv, 'revenue-export.csv');
    setActiveExport(null);
  }
  if (activeExport === 'payouts' && payoutsQuery.data) {
    downloadCsv(payoutsQuery.data.csv, 'payouts-export.csv');
    setActiveExport(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>Download your data as CSV files for offline analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleExport('clients')}
            disabled={activeExport === 'clients' && clientsQuery.isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            {activeExport === 'clients' && clientsQuery.isLoading
              ? 'Exporting...'
              : 'Export Clients'}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('revenue')}
            disabled={activeExport === 'revenue' && revenueQuery.isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            {activeExport === 'revenue' && revenueQuery.isLoading
              ? 'Exporting...'
              : 'Export Revenue'}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('payouts')}
            disabled={activeExport === 'payouts' && payoutsQuery.isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            {activeExport === 'payouts' && payoutsQuery.isLoading
              ? 'Exporting...'
              : 'Export Payouts'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
