'use client';

import { QRCodeSVG } from 'qrcode.react';

interface WaitingRoomFlyerProps {
  clinicName: string;
  clinicId: string;
}

export function WaitingRoomFlyer({ clinicName, clinicId }: WaitingRoomFlyerProps) {
  const enrollUrl = `https://www.fuzzycatapp.com/enroll/${clinicId}`;

  return (
    <div className="print-material mx-auto max-w-md rounded-lg border bg-white p-8 text-center text-black">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-teal-700">FuzzyCat</h2>
        <p className="mt-1 text-sm text-gray-500">Flexible Payment Plans</p>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold">Ask about payment plans!</h3>
        <p className="mt-2 text-gray-600">
          Split your vet bill into easy biweekly payments. No credit check, no interest.
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <QRCodeSVG value={enrollUrl} size={160} />
      </div>

      <p className="text-sm text-gray-500">Scan to learn more</p>

      <div className="mt-6 border-t pt-4">
        <p className="text-xs text-gray-400">
          Offered by {clinicName} in partnership with FuzzyCat
        </p>
      </div>
    </div>
  );
}
