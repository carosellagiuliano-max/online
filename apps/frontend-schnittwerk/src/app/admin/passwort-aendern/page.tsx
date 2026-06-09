import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { NewPasswordForm } from '@/components/auth';

export const metadata: Metadata = {
  title: 'Admin Passwort ändern | BeautifyPRO',
  robots: { index: false, follow: false },
};

export default function AdminNewPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-beauty p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-primary/8 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-radial from-rose/8 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-glow-sm">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gradient-primary mb-2">BeautifyPRO</h1>
          <p className="text-muted-foreground">Neues Admin-Passwort setzen</p>
        </div>

        <div className="card-elegant p-8 rounded-2xl">
          <NewPasswordForm
            returnHref="/admin/login"
            returnLabel="Zur Admin-Anmeldung"
          />
        </div>

        <div className="text-center mt-8">
          <Link
            href="/admin/login"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Zurück zur Admin-Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
