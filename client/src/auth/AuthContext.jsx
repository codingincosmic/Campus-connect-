/**
 * ---------------------------------------------------------------------------
 * AUTH STATE for the whole frontend.
 * ---------------------------------------------------------------------------
 *
 * The JWT lives in an httpOnly cookie, which JavaScript deliberately cannot
 * read. So to answer "who is logged in?" after a page refresh we ask the
 * server: GET /api/auth/me. That happens once, on mount.
 *
 * `context` holds the role-specific extras the server sends along:
 *   TEACHER -> { subjects }   STUDENT -> { classes }   PARENT -> { children }
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';

const AuthContext = createContext(null);

/** Landing page for each role, used for the post-login redirect. */
export const HOME_BY_ROLE = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PARENT: '/parent',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [context, setContext] = useState({});
  /** True only during the initial session check, so we don't flash the login page. */
  const [initializing, setInitializing] = useState(true);

  // --- Restore the session on first load ----------------------------------
  useEffect(() => {
    const controller = new AbortController();

    api
      .get('/auth/me', { signal: controller.signal })
      .then((data) => {
        setUser(data.user);
        setContext(data.context ?? {});
      })
      .catch((err) => {
        // A 401 here is the normal "not logged in yet" case, not a problem.
        if (err.name !== 'AbortError' && !(err instanceof ApiError && err.status === 401)) {
          console.warn('[auth] session check failed:', err.message);
        }
      })
      .finally(() => setInitializing(false));

    return () => controller.abort();
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    setUser(data.user);
    setContext(data.context ?? {});
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear local state even if the request failed, so the UI can't get stuck
      // showing a logged-in shell.
      setUser(null);
      setContext({});
    }
  }, []);

  /** Re-fetch user + context, e.g. after an admin changes something. */
  const refresh = useCallback(async () => {
    const data = await api.get('/auth/me');
    setUser(data.user);
    setContext(data.context ?? {});
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      context,
      initializing,
      isLoggedIn: Boolean(user),
      login,
      logout,
      refresh,
      setUser,
    }),
    [user, context, initializing, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read auth state from any component. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
