'use client';

import { Landmark } from 'lucide-react';
import { useCallback } from 'react';
import type { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';

interface PlaidLinkButtonProps {
  linkToken: string;
  onSuccess: (publicToken: string, accountId: string) => void;
  onExit: () => void;
  disabled?: boolean;
}

export function PlaidLinkButton({
  linkToken,
  onSuccess,
  onExit,
  disabled = false,
}: PlaidLinkButtonProps) {
  const handleSuccess = useCallback(
    (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      const accountId = metadata.accounts[0]?.id ?? '';
      onSuccess(publicToken, accountId);
    },
    [onSuccess],
  );

  const handleExit = useCallback(() => {
    onExit();
  }, [onExit]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full justify-start gap-3 h-auto py-4"
      onClick={() => open()}
      disabled={!ready || disabled}
    >
      <Landmark className="h-5 w-5" />
      <div className="text-left">
        <p className="font-medium">Connect your bank account</p>
        <p className="text-xs text-muted-foreground">
          Securely link via Plaid. We check your balance to ensure the plan works for you.
        </p>
      </div>
    </Button>
  );
}
