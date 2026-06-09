import type { ReactNode } from 'react';

export const metadata = {
  title: 'Salon einrichten',
  description: 'Richten Sie Ihren Salon ein',
};

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-background"
      data-theme-structure="classic"
      data-card-style="elevated"
      data-button-style="rounded"
      data-border-radius="soft"
    >
      {children}
    </div>
  );
}
