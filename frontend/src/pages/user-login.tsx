import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { validateEmail } from '@/utils/formatters';

export default function UserLoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Введіть email');
      return;
    }

    if (!validateEmail(email)) {
      setLocalError('Некоректний email');
      return;
    }

    if (!password) {
      setLocalError('Введіть пароль');
      return;
    }

    try {
      await login(email.trim(), password);
      await router.push('/user-home');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Не вдалося увійти');
    }
  };

  return (
    <>
      <Head>
        <title>Вхід користувача - SoftTurn</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900">Кабінет користувача</h1>
          <p className="text-sm text-gray-600 mt-2">Увійдіть з вашої пошти та пароля</p>

          {(localError || error) && (
            <div className="alert alert-error mt-5">
              <p>{localError || error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="form-group">
              <label htmlFor="user-email" className="form-label">Email</label>
              <input
                id="user-email"
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-password" className="form-label">Пароль</label>
              <input
                id="user-password"
                type="password"
                className="form-input"
                placeholder="Введіть пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Вхід...' : 'Увійти'}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-500">
            Якщо бачите помилку 401, перевірте пароль. Для нового акаунта попросіть адміністратора виконати скидання пароля.
          </p>

          <div className="mt-6 text-center text-sm text-gray-600">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-700 underline"
              onClick={() => void router.push('/login')}
            >
              Перейти до адмін-входу
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
