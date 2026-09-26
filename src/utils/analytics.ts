import { inject, track } from '@vercel/analytics';
import type { NewsEdition } from '../types/news';

type OutboundSourceClick = {
  source: string;
  edition: NewsEdition;
};

let analyticsInjected = false;

const ensureAnalytics = (): void => {
  if (analyticsInjected || typeof window === 'undefined') return;

  inject();
  analyticsInjected = true;
};

ensureAnalytics();

export const trackOutboundSourceClick = ({
  source,
  edition,
}: OutboundSourceClick): void => {
  if (typeof window === 'undefined') return;

  track('Outbound Source Click', {
    source: source.slice(0, 120),
    edition,
  });
};
