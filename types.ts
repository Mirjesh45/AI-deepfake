
export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  URL = 'URL'
}

export enum Verdict {
  REAL = 'Real',
  SUSPICIOUS = 'Suspicious',
  LIKELY_FAKE = 'Likely Fake'
}

export interface SignalWeight {
  name: string;
  multiplier: number; // 0.1x to 2.0x
}

export interface UserSettings {
  confidenceThreshold: number;
  autoFlagEnabled: boolean;
  signalWeights: SignalWeight[];
}

export interface SignalContribution {
  name: string;
  contribution_score: number; // Final impact score
  base_score?: number; // Original score from engine before tuning
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface DetectionResult {
  id: string; // Unique ID for batch tracking
  fileName: string;
  media_type: MediaType;
  confidence_score: number;
  verdict: Verdict;
  signals_detected: string[];
  signal_contributions?: SignalContribution[];
  recommendation: string;
  forensic_analysis: string;
  isOverridden?: boolean;
  isCalibrated?: boolean;
  grounding_sources?: GroundingSource[];
  url_metrics?: {
    redirect_chain_risk: number;
    whois_anomaly_score: number;
    certificate_transparency_score: number;
    domain_age_days?: number;
    hosting_provider?: string;
    threat_categories?: string[];
  };
}

export interface AnalysisState {
  id: string;
  fileName: string;
  isAnalyzing: boolean;
  result: DetectionResult | null;
  error: {
    code: string;
    message: string;
    guidance: string[];
    severity: 'critical' | 'warning' | 'info';
  } | null;
  progress: number;
  currentStage?: string;
}
