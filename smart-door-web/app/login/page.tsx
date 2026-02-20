'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Login page removed — auth handled by Cloudflare Access
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
