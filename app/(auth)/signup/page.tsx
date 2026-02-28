import { Building2, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose your account type or sign up below
          </p>
        </div>

        {/* Portal routing buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/signup/clinic">
            <Button variant="outline" className="w-full gap-2">
              <Building2 className="h-4 w-4" />
              Register Clinic
            </Button>
          </Link>
          <Link href="/signup/owner">
            <Button variant="outline" className="w-full gap-2">
              <User className="h-4 w-4" />
              Pet Owner
            </Button>
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or sign up directly</span>
          </div>
        </div>

        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
