'use client';

import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function InitiateEnrollmentButton() {
  return (
    <Button asChild size="lg">
      <Link href="/clinic/enroll">
        <PlusCircle className="h-4 w-4" />
        Initiate Enrollment
      </Link>
    </Button>
  );
}
