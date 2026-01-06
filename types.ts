
export interface ApprenticeshipProfile {
  title: string;
  region: string;
  industries: string[];
  skills: { hard: string[]; soft: string[] };
  credentials: string[];
  targetJobTitles: string[];
  wageRange?: string;
  startDate: string;
  ctaLink?: string;
  rawDescription?: string;
  toolsAndTech?: string[];
  primaryContact?: string;
  suggestions?: string[];
  // Enhanced Fields
  elevatorPitch: string;
  geoAnalytics: string;
  primaryContactInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
  siteSummary?: string;
  safetyAssessment: string;
}

export enum OutreachSegment {
  TALENT_PIPELINE = "Talent Pipeline & Retention",
  COST_REDUCTION = "Cost/Time-to-ProductIVITY Reduction",
  SAFETY_COMPLIANCE = "Safety & Compliance Readiness",
  COMMUNITY_INVESTMENT = "Community Investment & Workforce Funding"
}

export interface EmployerMatch {
  name: string;
  score: number;
  rationale: string;
  segment: OutreachSegment;
  industryAlignment: number;
  jobTitleOverlap: number;
  skillOverlap: number;
  geographicProximity: number;
  hiringSignals: number;
  website?: string;
  phone?: string;
  contactEmail?: string;
}

export interface OutreachAssets {
  primaryEmail: string;
  followUps: string[];
  callScript: string[];
  subjectLines: string[];
  linkedInMessage: string;
}

export interface LinkedInPost {
  day: number;
  pillar: string;
  content: string;
  hashtags: string[];
  imageUrl?: string;
}

export type Step = 'landing' | 'intake' | 'discovery' | 'report' | 'outreach' | 'linkedin' | 'chat' | 'docs' | 'terms';
