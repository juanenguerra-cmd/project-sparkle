import { useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PillInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

const PillInput = ({ value, onChange, placeholder = 'Type and press Enter', addLabel = 'Add' }: PillInputProps) => {
  const [inputValue, setInputValue] = useState('');

  const normalizedSet = useMemo(() => new Set(value.map((item) => item.toLowerCase())), [value]);

  const addItem = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (normalizedSet.has(next.toLowerCase())) return;
    onChange([...value, next]);
    setInputValue('');
  };

  const removeItem = (itemToRemove: string) => {
    onChange(value.filter((item) => item !== itemToRemove));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addItem(inputValue);
    }
  };

  return (
    <div className="rounded-md border border-input bg-background p-2">
      <div className="mb-2 flex flex-wrap gap-1">
        {value.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1 pr-1">
            {item}
            <button type="button" onClick={() => removeItem(item)} className="rounded-full p-0.5 hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addItem(inputValue)}
          placeholder={placeholder}
          className="h-8"
        />
        <Button type="button" size="sm" variant="outline" onClick={() => addItem(inputValue)}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
};

export default PillInput;
