import { Cat } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { OwnerLoginForm } from './_components/owner-login-form';

export const metadata: Metadata = {
  title: 'Pet Owner Login | FuzzyCat',
};

export default function OwnerLoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel: teal gradient with cat photo + quote */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-teal-600 to-teal-700 p-12 text-white lg:flex lg:w-[40%]">
        <div className="max-w-sm space-y-8">
          <Image
            src="/sharkie.webp"
            alt="A black cat lounging comfortably"
            width={320}
            height={280}
            className="rounded-xl shadow-lg"
            sizes="320px"
            priority
          />
          <div>
            <Cat className="mb-3 h-8 w-8 text-teal-200" />
            <blockquote className="text-2xl font-semibold leading-relaxed">
              &ldquo;Because your best friend deserves the best care.&rdquo;
            </blockquote>
            <p className="mt-4 text-teal-200">
              Flexible payment plans for veterinary care. No credit check. No interest.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel: login form */}
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
        <OwnerLoginForm />
      </div>
    </div>
  );
}
