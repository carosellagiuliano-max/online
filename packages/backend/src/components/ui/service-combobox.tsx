'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

interface ServiceComboboxProps {
  services: Service[];
  value: string;
  onValueChange: (value: string, service: Service | undefined) => void;
  placeholder?: string;
}

export function ServiceCombobox({
  services,
  value,
  onValueChange,
  placeholder = 'Service wählen...',
}: ServiceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedService = services.find((s) => s.id === value);

  const filteredServices = React.useMemo(() => {
    if (!search) return services;
    const searchLower = search.toLowerCase();
    return services.filter((s) =>
      s.name.toLowerCase().includes(searchLower)
    );
  }, [services, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedService ? (
            <span className="flex items-center justify-between w-full">
              <span className="truncate">{selectedService.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {selectedService.duration_minutes} Min.
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Service suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredServices.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Kein Service gefunden.
            </div>
          ) : (
            filteredServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                  value === service.id && 'bg-accent text-accent-foreground'
                )}
                onClick={() => {
                  onValueChange(service.id, service);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === service.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex flex-1 items-center justify-between">
                  <span>{service.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {service.duration_minutes} Min. &middot; CHF {(service.price_cents / 100).toFixed(2)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
