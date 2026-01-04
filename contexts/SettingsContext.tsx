
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserSettings, SignalWeight } from '../types';

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  updateSignalWeight: (name: string, multiplier: number) => void;
  resetWeights: () => void;
}

const STORAGE_KEY = 'sentinel_forensic_settings';

const DEFAULT_SIGNAL_WEIGHTS: SignalWeight[] = [
  { name: 'Spectral Gaps', multiplier: 1.0 },
  { name: 'Pitch Inconsistency', multiplier: 1.0 },
  { name: 'Lip-Sync Alignment', multiplier: 1.0 },
  { name: 'Blink Patterns', multiplier: 1.0 },
  { name: 'Temporal Artifacts', multiplier: 1.0 },
  { name: 'GAN Geometry', multiplier: 1.0 },
  { name: 'Lighting Consistency', multiplier: 1.0 },
  { name: 'Frequency Anomalies', multiplier: 1.0 },
  { name: 'Redirect Chains', multiplier: 1.0 },
  { name: 'WHOIS Anomalies', multiplier: 1.0 },
  { name: 'Certificate Trust', multiplier: 1.0 },
];

const DEFAULT_SETTINGS: UserSettings = {
  confidenceThreshold: 85,
  autoFlagEnabled: true,
  signalWeights: DEFAULT_SIGNAL_WEIGHTS,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure new default signals are merged if they don't exist in saved state
        const mergedWeights = DEFAULT_SIGNAL_WEIGHTS.map(dw => {
          const savedWeight = (parsed.signalWeights as SignalWeight[])?.find(sw => sw.name === dw.name);
          return savedWeight || dw;
        });

        return { 
          ...DEFAULT_SETTINGS, 
          ...parsed,
          signalWeights: mergedWeights
        };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateSignalWeight = (name: string, multiplier: number) => {
    setSettings((prev) => ({
      ...prev,
      signalWeights: prev.signalWeights.map(sw => 
        sw.name === name ? { ...sw, multiplier } : sw
      )
    }));
  };

  const resetWeights = () => {
    setSettings(prev => ({
      ...prev,
      signalWeights: DEFAULT_SIGNAL_WEIGHTS
    }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateSignalWeight, resetWeights }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
