'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/stock-movements'); }, [router]);
  return null;
}
