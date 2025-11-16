import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface UseRequireAuthOptions {
  allowedRoles?: Array<'user' | 'agent' | 'admin'>;
  redirectTo?: string;
}

export const useRequireAuth = (options: UseRequireAuthOptions = {}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    allowedRoles = [],
    redirectTo = '/login'
  } = options;

  useEffect(() => {
    if (isLoading) {
      return; // Don't redirect while loading
    }

    if (!isAuthenticated) {
      navigate(redirectTo, {
        state: { from: location },
        replace: true
      });
      return;
    }

    if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
      navigate('/unauthorized', { replace: true });
      return;
    }
  }, [isAuthenticated, user, isLoading, allowedRoles, redirectTo, navigate, location]);

  return {
    isAuthenticated,
    user,
    isLoading,
    hasRequiredRole: allowedRoles.length === 0 || (user && allowedRoles.includes(user.role))
  };
};