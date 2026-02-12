'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signUpClinic, signUpOwner } from './actions';

type Tab = 'owner' | 'clinic';

export function SignupForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('owner');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = tab === 'owner' ? await signUpOwner(formData) : await signUpClinic(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(tab === 'owner' ? '/owner/payments' : '/clinic/dashboard');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border border-gray-300">
        <button
          type="button"
          onClick={() => setTab('owner')}
          className={`flex-1 rounded-l-md px-4 py-2 text-sm font-medium ${
            tab === 'owner' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Pet Owner
        </button>
        <button
          type="button"
          onClick={() => setTab('clinic')}
          className={`flex-1 rounded-r-md px-4 py-2 text-sm font-medium ${
            tab === 'clinic' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Veterinary Clinic
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {tab === 'owner' ? <OwnerFields /> : <ClinicFields />}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function OwnerFields() {
  return (
    <>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="petName" className="block text-sm font-medium text-gray-700">
          Pet name
        </label>
        <input
          id="petName"
          name="petName"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </>
  );
}

function ClinicFields() {
  return (
    <>
      <div>
        <label htmlFor="clinicName" className="block text-sm font-medium text-gray-700">
          Clinic name
        </label>
        <input
          id="clinicName"
          name="clinicName"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="addressState" className="block text-sm font-medium text-gray-700">
            State
          </label>
          <input
            id="addressState"
            name="addressState"
            type="text"
            required
            maxLength={2}
            placeholder="CA"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="addressZip" className="block text-sm font-medium text-gray-700">
            ZIP code
          </label>
          <input
            id="addressZip"
            name="addressZip"
            type="text"
            required
            maxLength={10}
            placeholder="94105"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </>
  );
}
