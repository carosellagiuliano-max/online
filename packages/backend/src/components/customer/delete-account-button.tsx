'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { deleteCustomerAccount } from '@/lib/actions/customer';
import { useAuth } from '@/lib/auth/context';

interface DeleteAccountButtonProps {
  userId: string;
}

export function DeleteAccountButton({ userId }: DeleteAccountButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const router = useRouter();
  const { signOut } = useAuth();

  const handleDelete = async () => {
    if (confirmText !== 'LÖSCHEN') {
      toast.error('Bitte geben Sie "LÖSCHEN" ein, um fortzufahren.');
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteCustomerAccount(userId);

      if (result.success) {
        toast.success('Ihr Konto wurde gelöscht');
        // Sign out and redirect to home
        await signOut();
        router.push('/');
      } else {
        toast.error(result.error || 'Fehler beim Löschen des Kontos');
      }
    } catch {
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Konto löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Konto wirklich löschen?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Diese Aktion kann nicht rückgängig gemacht werden. Ihr Konto wird dauerhaft
              deaktiviert und Ihre persönlichen Daten werden anonymisiert.
            </p>
            <p>
              Bestehende Termine bleiben erhalten, aber Sie können sich nicht mehr anmelden
              oder neue Termine buchen.
            </p>
            <div className="pt-2">
              <Label htmlFor="confirm" className="text-foreground">
                Geben Sie <span className="font-mono font-bold">LÖSCHEN</span> ein, um zu bestätigen:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="LÖSCHEN"
                className="mt-2"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== 'LÖSCHEN'}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gelöscht...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Konto endgültig löschen
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
