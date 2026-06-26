export type HotspotFlowKind = 'voucher' | 'payment' | 'reconnect';
export type HotspotFlowState = 'success' | 'active' | 'failed' | 'pending';

export interface HotspotPortalFeedback {
  title: string;
  message: string;
  autoConnect: boolean;
}

export function buildHotspotPortalFeedback({
  kind,
  state,
}: {
  kind: HotspotFlowKind;
  state: HotspotFlowState;
}): HotspotPortalFeedback {
  switch (kind) {
    case 'voucher':
      if (state === 'success') {
        return {
          title: 'Successfully activated',
          message: 'Your package is active. Connecting you now.',
          autoConnect: true,
        };
      }
      break;
    case 'payment':
      if (state === 'success') {
        return {
          title: 'Successfully activated',
          message: 'Payment confirmed. Connecting you now.',
          autoConnect: true,
        };
      }
      if (state === 'failed') {
        return {
          title: 'Connection failed',
          message: 'We could not complete the connection. Please try again.',
          autoConnect: false,
        };
      }
      if (state === 'pending') {
        return {
          title: 'Waiting for payment',
          message: 'Please complete the payment prompt on your phone.',
          autoConnect: false,
        };
      }
      break;
    case 'reconnect':
      if (state === 'active') {
        return {
          title: 'Your package is still active',
          message: 'Your package is still active. Reconnecting now.',
          autoConnect: true,
        };
      }
      break;
  }

  return {
    title: 'Connection status',
    message: 'Please try again in a moment.',
    autoConnect: false,
  };
}
