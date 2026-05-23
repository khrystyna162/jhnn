import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError('Введіть логін');
      return;
    }

    if (!password) {
      setLocalError('Введіть пароль');
      return;
    }

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Помилка при вході. Перевірте логін та пароль.',
      );
    }
  };

  return (
    <>
      <Head>
        <title>Вхід - SoftTurn</title>
        <meta name="description" content="Вхід в систему SoftTurn" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">SoftTurn</h1>
              <p className="text-gray-600">Система електронної черги</p>
            </div>

            {/* Error Alert */}
            {(localError || error) && (
              <div className="alert alert-error mb-6">
                <p>{localError || error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Логін
                </label>
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="user@example.com або номер телефону"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Введіть пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mb-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner mr-2"></span>
                    Входження...
                  </>
                ) : (
                  'Увійти'
                )}
              </button>

              <button
                type="button"
                className="btn btn-white w-full"
                onClick={() => void router.push('/user-login')}
                disabled={isLoading}
              >
                Вхід для звичайного користувача
              </button>
            </form>

            {/* Footer */}
            <div className="text-center text-sm text-gray-600">
              <p>Демо-облік для тестування:</p>
              <p className="mt-2 font-mono text-xs">
                <span className="block">Оператор: operator@example.com / password123</span>
                <span className="block">Адмін: admin@example.com / password123</span>
                <span className="block">Сисадмін: sysadmin@example.com / password123</span>
              </p>
            </div>
          </div>

          {/* Support Link */}
          <div className="text-center mt-6 text-white text-sm">
            <p>Потрібна допомога? Зв&apos;яжіться з tekniks: support@softturn.ua</p>
          </div>
        </div>
      </div>
    </>
  );
}
