import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="mt-2 text-sm text-gray-600">Sign up as a pet owner or veterinary clinic</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
