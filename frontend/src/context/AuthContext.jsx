import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('imboni_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('imboni_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('imboni_token', data.token);
    setUser(data.user);
    setMustChangePassword(!!data.must_change_password);
    return data;
  }

  function logout() {
    localStorage.removeItem('imboni_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, mustChangePassword, setMustChangePassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
