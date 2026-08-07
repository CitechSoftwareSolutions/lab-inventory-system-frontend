'use client';
import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push('/dashboard'), 2200);
    return () => clearTimeout(t);
  }, [success, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setErrorMsg(message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissError = () => {
    setErrorMsg(null);
    setUsername('');
    setPassword('');
    setTimeout(() => usernameRef.current?.focus(), 50);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes circle-pop {
          0%   { transform: scale(0);   opacity: 0; }
          65%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes check-draw {
          0%   { stroke-dashoffset: 80; }
          100% { stroke-dashoffset: 0;  }
        }
        @keyframes ring-pulse {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.55); opacity: 0;   }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .anim-circle  { animation: circle-pop  0.55s cubic-bezier(.34,1.56,.64,1) 0.15s both; }
        .anim-ring    { animation: ring-pulse   0.9s ease-out               0.55s both; }
        .anim-check   {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          animation: check-draw 0.45s ease-out 0.6s both;
        }
        .anim-title   { animation: fade-up 0.4s ease-out 0.85s both; }
        .anim-sub     { animation: fade-up 0.4s ease-out 1.05s both; }
      ` }} />

      <div className="min-h-screen bg-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Inventory System</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Username or Email</label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter username or email"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Default: admin / Admin@123
          </p>
        </div>
      </div>

      {/* ── Success overlay ────────────────────────────────────────── */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.97)' }}>
          <div className="text-center select-none">
            {/* pulsing ring behind the circle */}
            <div className="relative inline-flex items-center justify-center mb-6">
              <span
                className="anim-ring absolute w-24 h-24 rounded-full"
                style={{ background: 'rgba(22,163,74,0.25)' }}
              />
              <span className="anim-circle inline-flex items-center justify-center w-24 h-24 rounded-full shadow-xl"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <svg viewBox="0 0 52 52" fill="none" className="w-12 h-12">
                  <path
                    className="anim-check"
                    d="M13 27l9.5 9.5 17-20"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <h2 className="anim-title text-2xl font-bold text-gray-900 mb-2">Login Successful!</h2>
            <p className="anim-sub text-gray-500 text-sm">Redirecting to dashboard…</p>
          </div>
        </div>
      )}

      {/* ── Error popup ────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Login Failed</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={handleDismissError}
              className="btn-primary w-full py-2.5 text-sm"
              autoFocus
            >
              OK — Try Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
