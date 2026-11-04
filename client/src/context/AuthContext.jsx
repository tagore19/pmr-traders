import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('pmr_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('pmr_token') || null);

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('pmr_user', JSON.stringify(userData));
    localStorage.setItem('pmr_token', jwt);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pmr_user');
    localStorage.removeItem('pmr_token');
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
