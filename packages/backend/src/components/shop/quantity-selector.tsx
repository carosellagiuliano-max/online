'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantitySelector({
  quantity,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: QuantitySelectorProps) {
  const decrease = () => {
    if (quantity > min) {
      onChange(quantity - 1);
    }
  };

  const increase = () => {
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={decrease}
        disabled={disabled || quantity <= min}
        className="h-10 w-10"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="w-12 text-center font-medium tabular-nums">
        {quantity}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={increase}
        disabled={disabled || quantity >= max}
        className="h-10 w-10"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
