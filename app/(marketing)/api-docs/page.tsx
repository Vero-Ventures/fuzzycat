import { BookOpen, Code2, FileJson } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'API Documentation',
  description:
    'FuzzyCat REST API for veterinary clinic integrations. Create payment plans, check plan status, and receive webhooks from your practice management software.',
};

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">API Documentation</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Integrate FuzzyCat payment plans into your veterinary practice management system.
        </p>
      </div>

      <Separator className="my-10" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Code2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-center text-xl">REST API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The FuzzyCat REST API allows veterinary practice management systems to create payment
              plan enrollments, check plan status, manage clients, and receive webhook notifications
              directly from existing software.
            </p>
            <p className="text-muted-foreground">
              API keys can be generated from the{' '}
              <Link href="/login" className="text-primary hover:underline">
                Clinic Portal
              </Link>{' '}
              under Settings. Authenticate requests using your API key in the{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">Authorization: Bearer</code>{' '}
              header.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <CardTitle className="text-center text-xl">Interactive API Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Browse the full API reference with request/response examples, try endpoints directly
              in your browser, and generate client code in any language.
            </p>
            <Link href="/api/v1/docs">
              <Button>
                <BookOpen className="mr-2 h-4 w-4" />
                Open API Reference
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileJson className="h-6 w-6" />
            </div>
            <CardTitle className="text-center text-xl">OpenAPI Specification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              The full API specification is available in OpenAPI 3.1 format. Use it to explore
              endpoints, generate client libraries, or import into tools like Postman.
            </p>
            <Link href="/api/v1/openapi.json">
              <Button variant="outline">
                <FileJson className="mr-2 h-4 w-4" />
                View OpenAPI Spec
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Need help with your integration? Use the feedback button in the bottom-right corner of the
          page.
        </p>
      </div>
    </div>
  );
}
