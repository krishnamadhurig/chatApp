import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((res) => setUser(res.data.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const saveSession = ({ user, token }) => {
    localStorage.setItem('token', token);
    setUser(user);
  };

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    saveSession(res.data.data);
  };

  const signup = async (details) => {
    const res = await authApi.signup(details);
    saveSession(res.data.data);
  };

   const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('activeConversation');
    setUser(null);
  };
  
  const updateUser = (next) => setUser(next);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);