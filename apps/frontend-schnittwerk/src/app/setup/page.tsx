import { redirect } from 'next/navigation';
import { SetupWizard } from '@/components/setup';
import { checkSetupStatus } from '@/lib/setup/check-setup';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const status = await checkSetupStatus();

  // If setup is complete or wizard is disabled, redirect away
  if (!status.needsSetup || !status.wizardEnabled) {
    redirect('/');
  }

  return <SetupWizard />;
}
