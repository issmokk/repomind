import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContext } from '@/app/api/repos/_helpers';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const encryptedToken = user?.app_metadata?.encrypted_github_token;

  if (!encryptedToken) {
    return NextResponse.json(
      { error: 'github_token_missing', reconnect: true },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = decrypt(encryptedToken);
  } catch {
    return NextResponse.json(
      { error: 'github_token_missing', reconnect: true },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('per_page') ?? '100';
  const sort = searchParams.get('sort') ?? 'updated';
  const direction = searchParams.get('direction') ?? 'desc';

  const ghUrl = `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&direction=${direction}`;

  const ghRes = await fetch(ghUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (ghRes.status === 401) {
    return NextResponse.json(
      { error: 'github_token_expired', reconnect: true },
      { status: 401 },
    );
  }

  const data = await ghRes.json();
  return NextResponse.json(data);
}
