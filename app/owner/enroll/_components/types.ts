export interface EnrollmentData {
  clinicId: string;
  clinicName: string;
  billAmountCents: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  petName: string;
  paymentMethod: 'debit_card' | 'bank_account';
  plaidPublicToken: string | null;
  disclaimersAccepted: boolean;
  captchaVerified: boolean;
  captchaToken: string | null;
  planId: string | null;
}

export const INITIAL_ENROLLMENT_DATA: EnrollmentData = {
  clinicId: '',
  clinicName: '',
  billAmountCents: 0,
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  petName: '',
  paymentMethod: 'debit_card',
  plaidPublicToken: null,
  disclaimersAccepted: false,
  captchaVerified: false,
  captchaToken: null,
  planId: null,
};
