/** Banks offered for net banking; the id is stored on the saved instrument. */
export const NET_BANKING_OPTIONS = [
  { id: 'hdfc', name: 'HDFC Bank' },
  { id: 'sbi', name: 'State Bank of India' },
  { id: 'icici', name: 'ICICI Bank' },
  { id: 'axis', name: 'Axis Bank' },
  { id: 'kotak', name: 'Kotak Mahindra Bank' },
  { id: 'pnb', name: 'Punjab National Bank' },
] as const;

/** Prepaid wallets the checkout can route to. */
export const WALLET_OPTIONS = [
  { id: 'paytm', name: 'Paytm' },
  { id: 'amazonpay', name: 'Amazon Pay' },
  { id: 'mobikwik', name: 'Mobikwik' },
  { id: 'freecharge', name: 'Freecharge' },
] as const;

export const NET_BANKING_IDS = NET_BANKING_OPTIONS.map((option) => option.id);
export const WALLET_IDS = WALLET_OPTIONS.map((option) => option.id);
