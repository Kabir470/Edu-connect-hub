import Constants from 'expo-constants';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLACEHOLDER_PATTERN = /your-cloud-function-url/i;

const getPaymentConfig = () => {
  const expoConfig = Constants?.expoConfig || Constants?.manifest || {};
  const extra = expoConfig?.extra || {};
  const paymentExtra = extra?.payment || {};
  const rawBase = paymentExtra.apiBaseUrl || process.env?.EXPO_PUBLIC_PAYMENT_API_BASE || '';
  const trimmedBase = (rawBase || '').trim();
  const hasRealBase = trimmedBase && !PLACEHOLDER_PATTERN.test(trimmedBase);
  return {
    apiBaseUrl: hasRealBase ? trimmedBase.replace(/\/$/, '') : '',
    defaultCurrency: paymentExtra.currency || 'BDT',
    demoMode: typeof paymentExtra.demoMode === 'boolean' ? paymentExtra.demoMode : !hasRealBase,
    sandboxGatewayUrl: paymentExtra.sandboxGatewayUrl || 'https://sandbox.sslcommerz.com/EasyCheckOut/testbox/',
    mockDelayMs: Number(paymentExtra.mockDelayMs || 2500),
  };
};

const ensureApiBase = () => {
  const config = getPaymentConfig();
  if (!config.apiBaseUrl) {
    throw new Error('Payment API base URL is not configured. Update app.json extra.payment.apiBaseUrl or set EXPO_PUBLIC_PAYMENT_API_BASE.');
  }
  return config.apiBaseUrl;
};

const normalizeStatus = (statusPayload = {}) => {
  const raw = (statusPayload.paymentStatus || statusPayload.status || '').toString().toLowerCase();
  if (['valid', 'paid', 'success', 'successful'].includes(raw)) return 'paid';
  if (['failed', 'cancelled', 'canceled', 'expired', 'invalid'].includes(raw)) return 'failed';
  return 'pending';
};

const createDemoSession = ({ amount, currency }) => {
  const config = getPaymentConfig();
  const sessionKey = `demo-${Date.now()}`;
  return {
    gatewayUrl: config.sandboxGatewayUrl,
    sessionKey,
    transactionId: `demo-txn-${Date.now()}`,
    amount,
    currency: currency || config.defaultCurrency,
    demo: true,
  };
};

export const createSslCommerzSession = async ({ amount, user, expert, slot, currency }) => {
  const config = getPaymentConfig();
  if (config.demoMode || !config.apiBaseUrl) {
    return createDemoSession({ amount, currency });
  }
  const base = config.apiBaseUrl;
  const body = {
    amount,
    currency: currency || config.defaultCurrency,
    user: {
      id: user?.uid,
      name: user?.fullName || user?.displayName || user?.email || 'Customer',
      email: user?.email,
      phone: user?.phoneNumber || user?.phone || '0000000000',
    },
    expert: {
      id: expert?.id,
      name: expert?.fullName || expert?.name,
    },
    slot: {
      id: slot?.id,
      start: slot?.start,
      durationMinutes: slot?.durationMinutes,
    },
  };

  let response;
  try {
    response = await fetch(`${base}/payments/sslcommerz/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    console.error('SSLCommerz session network error', networkError);
    throw new Error('Unable to reach payment service. Check your internet connection or payment API base URL.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to create SSLCommerz payment session');
  }

  if (!payload.gatewayUrl || !payload.sessionKey) {
    throw new Error('Payment gateway response missing session information');
  }

  return {
    gatewayUrl: payload.gatewayUrl,
    sessionKey: payload.sessionKey,
    transactionId: payload.transactionId || payload.tranId || payload.tran_id,
    amount: payload.amount || amount,
    currency: payload.currency || body.currency,
  };
};

export const fetchSslCommerzStatus = async (sessionKey) => {
  if (!sessionKey) throw new Error('Session key required');
  const config = getPaymentConfig();
  if (sessionKey.startsWith('demo-') || config.demoMode || !config.apiBaseUrl) {
    return { status: 'paid', paymentStatus: 'paid', sessionKey };
  }
  const base = ensureApiBase();
  let response;
  try {
    response = await fetch(`${base}/payments/sslcommerz/status/${sessionKey}`);
  } catch (networkError) {
    console.error('SSLCommerz status network error', networkError);
    throw new Error('Unable to reach payment service for status update.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to fetch payment status');
  }
  return payload;
};

export const waitForSslPaymentConfirmation = async ({ sessionKey, pollIntervalMs = 4000, timeoutMs = 120000 }) => {
  const config = getPaymentConfig();
  if (sessionKey?.startsWith('demo-') || config.demoMode || !config.apiBaseUrl) {
    await sleep(config.mockDelayMs || 2000);
    return {
      status: 'paid',
      transactionId: `demo-confirm-${Date.now()}`,
      amount: null,
      currency: config.defaultCurrency,
      sessionKey,
      gateway: 'sslcommerz-demo',
      meta: { note: 'Demo payment auto-approved' },
    };
  }
  const started = Date.now();
  let lastPayload = null;
  while (Date.now() - started < timeoutMs) {
    const statusPayload = await fetchSslCommerzStatus(sessionKey);
    lastPayload = statusPayload;
    const normalized = normalizeStatus(statusPayload);
    if (normalized === 'paid') {
      return {
        status: 'paid',
        transactionId: statusPayload.transactionId || statusPayload.tran_id || statusPayload.bank_tran_id,
        amount: Number(statusPayload.amount) || Number(statusPayload.store_amount) || null,
        currency: statusPayload.currency || statusPayload.currency_type,
        sessionKey,
        gateway: 'sslcommerz',
        meta: statusPayload,
      };
    }
    if (normalized === 'failed') {
      throw new Error('Payment was not completed. Current status: ' + (statusPayload.paymentStatus || statusPayload.status));
    }
    await sleep(pollIntervalMs);
  }
  const statusText = lastPayload?.paymentStatus || lastPayload?.status || 'unknown';
  throw new Error(`Payment confirmation timed out (last status: ${statusText}).`);
};
