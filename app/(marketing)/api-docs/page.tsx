import { Code2, Mail } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'API Documentation',
  description:
    'FuzzyCat API documentation for veterinary clinic integrations. Contact us for API access and integration support.',
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

      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Code2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We are building a REST API that will allow veterinary practice management systems to
            create payment plans, check plan status, and receive webhook notifications directly from
            their existing software.
          </p>
          <p className="text-muted-foreground">
            If you are interested in early access or have integration requirements, our team would
            love to hear from you.
          </p>
          <div className="flex items-center justify-center pt-2">
            <a href="mailto:support@fuzzycatapp.com?subject=API%20Integration%20Inquiry">
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Contact Us for API Access
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
