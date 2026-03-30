import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/crypto';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token && process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
        try {
          const encrypted = encrypt(session.provider_token);
          await getAdminClient().auth.admin.updateUserById(session.user.id, {
            app_metadata: { encrypted_github_token: encrypted },
          });
        } catch {
          // Token storage failed; user can still use the app without GitHub browsing
        }
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
