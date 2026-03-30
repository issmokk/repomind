'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

interface ManualRepoInputProps {
  onSubmit: (fullName: string) => void;
  loading?: boolean;
}

export function ManualRepoInput({ onSubmit, loading }: ManualRepoInputProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid = REPO_PATTERN.test(value);
  const showError = touched && value.length > 0 && !isValid;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div>
        <Input
          placeholder="owner/repo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
        />
        {showError && (
          <p className="text-xs text-destructive mt-1">
            Invalid format. Use owner/repo (e.g. facebook/react).
          </p>
        )}
      </div>
      <Button onClick={() => onSubmit(value)} disabled={!value || !isValid || loading}>
        {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
        Add
      </Button>
    </div>
  );
}
