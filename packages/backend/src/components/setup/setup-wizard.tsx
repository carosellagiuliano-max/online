'use client';

import { SetupProvider, useSetup } from './setup-context';
import { SetupProgress } from './setup-progress';
import {
  AdminStep,
  SalonStep,
  HoursStep,
  ServicesStep,
  CompleteStep,
} from './steps';

function SetupWizardContent() {
  const { state } = useSetup();

  const renderStep = () => {
    switch (state.currentStep) {
      case 'admin':
        return <AdminStep />;
      case 'salon':
        return <SalonStep />;
      case 'hours':
        return <HoursStep />;
      case 'services':
        return <ServicesStep />;
      case 'complete':
        return <CompleteStep />;
      default:
        return <AdminStep />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Salon einrichten</h1>
          <p className="text-muted-foreground">
            Richten Sie Ihren Salon in wenigen Schritten ein
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <SetupProgress />
        </div>

        {/* Step Content */}
        <div className="bg-card border rounded-lg p-6 sm:p-8 shadow-sm">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

export function SetupWizard() {
  return (
    <SetupProvider>
      <SetupWizardContent />
    </SetupProvider>
  );
}
