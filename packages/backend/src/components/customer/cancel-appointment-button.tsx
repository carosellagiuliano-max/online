'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
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
import { toast } from 'sonner';
import { cancelAppointment } from '@/lib/actions';

interface CancelAppointmentButtonProps {
  appointmentId: string;
  customerId: string;
}

export function CancelAppointmentButton({
  appointmentId,
  customerId,
}: CancelAppointmentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleCancel() {
    setIsLoading(true);

    try {
      const result = await cancelAppointment(appointmentId, customerId);

      if (!result.success) {
        toast.error(result.error || 'Stornierung fehlgeschlagen.');
        return;
      }

      toast.success('Termin wurde storniert.');
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error('Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <XCircle className="h-4 w-4 mr-2" />
          Termin stornieren
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Termin stornieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie diesen Termin wirklich stornieren? Diese Aktion kann nicht rückgängig
            gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stornieren...
              </>
            ) : (
              'Termin stornieren'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
