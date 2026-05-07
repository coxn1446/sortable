import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setUser,
  clearUser,
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
} from '../store/auth.reducer';
import { fetchCurrentUser } from '../helpers/authHelpers';

export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const loading = useSelector(selectAuthLoading);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const u = await fetchCurrentUser();
        if (!cancelled) {
          if (u) dispatch(setUser(u));
          else dispatch(clearUser());
        }
      } catch (error) {
        if (!cancelled) dispatch(clearUser());
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return { user, isAuthenticated, loading };
}
