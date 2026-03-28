import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Settings className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Configure embedding providers, team settings, and API keys.
        </p>
      </div>
    </div>
  );
}
