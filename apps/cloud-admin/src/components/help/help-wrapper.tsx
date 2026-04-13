'use client';

import { TourProvider } from './tour-engine';
import { HelpButton } from './help-panel';
import { OnboardingWizard } from './onboarding-wizard';

export function HelpWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      {children}
      <HelpButton />
      <OnboardingWizard />
    </TourProvider>
  );
}
