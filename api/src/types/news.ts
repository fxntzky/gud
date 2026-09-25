export type NewsCategory =
  | 'world'
  | 'science'
  | 'planet'
  | 'people'
  | 'health'
  | 'culture'
  | 'animals'
  | 'technology';

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
  excerpt?: string;
  imageUrl?: string;
  imageCandidates?: string[];
  score: number;
}

export interface NewsDiagnostics {
  imageCount?: number;
  imageCoverage?: number;
  windowHours: number;
  preferredWindowHours?: number;
  selectedLookbackHours?: number;
  windowStart: string;
  windowEnd: string;
  totalFeedItems: number;
  rejections: {
    invalid: number;
    blocked: number;
    outOfWindow: number;
    disqualified: number;
    noPositiveOutcome: number;
    belowScore: number;
  };
  failedSources: Array<{
    source: string;
    id: string;
    reason: string;
  }>;
}

export interface NewsResponse {
  articles: NewsArticle[];
  generatedAt: string;
  editionDate: string;
  issueNumber: number;
  count: number;
  editionLimit: number;
  editorialRulesetVersion?: string;
  uniqueSources: number;
  sourcePool?: number;
  successfulSources?: number;
  sourcesWithCandidates?: number;
  candidateCount?: number;
  diagnostics?: NewsDiagnostics;
}
