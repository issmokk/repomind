'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  async function handleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm space-y-6 p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">RepoMind</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered codebase context engine
          </p>
        </div>
        <Button onClick={handleLogin} className="w-full">
          Sign in with GitHub
        </Button>
      </Card>
    </div>
  );
}
