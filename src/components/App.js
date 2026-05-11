import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';

import { listRoutePath } from '../helpers/listRoutePaths';
import { fetchListBySlug } from '../helpers/listHelpers';
import { NativeProvider } from '../utils/NativeContext';
import { useAuth } from '../hooks/useAuth';
import { acceptUpdatedPolicies, logout } from '../helpers/authHelpers';
import {
  clearUser,
  selectAuthLoading,
  selectIsAuthenticated,
  selectUser,
  setUser,
} from '../store/auth.reducer';
import PolicyConsentModal from './legal/PolicyConsentModal';
import Nav from './Nav/Nav';
import Loading from './Loading/Loading';

const Home = lazy(() => import('../routes/Home'));
const Privacy = lazy(() => import('../routes/Privacy'));
const Terms = lazy(() => import('../routes/Terms'));
const Login = lazy(() => import('../routes/Login'));
const Register = lazy(() => import('../routes/Register'));
const Profile = lazy(() => import('../routes/Profile'));
const NotFound = lazy(() => import('../routes/NotFound'));
const CreateList = lazy(() => import('../routes/CreateList'));
const ListPage = lazy(() => import('../routes/ListPage'));
const Discover = lazy(() => import('../routes/Discover'));
const Activity = lazy(() => import('../routes/Activity'));
const ListsPage = lazy(() => import('../routes/ListsPage'));

let oauthSignedInToastLatch = false;

function LegacySlugToListRedirect() {
  const { slug } = useParams();
  const [target, setTarget] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchListBySlug(slug)
      .then((d) => {
        if (!cancelled) setTarget(listRoutePath(String(d.list.list_id)));
      })
      .catch(() => {
        if (!cancelled) setTarget(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (target === false) return <Navigate to="/" replace />;
  if (target === undefined) return <Loading />;
  return <Navigate to={target} replace />;
}

function LegacyListCompareRedirect() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const reset = params.get('reset') === '1' ? '1' : undefined;
  return <Navigate to={listRoutePath(id, reset ? { reset } : {})} replace />;
}

function LegacyListResultsRedirect() {
  const { id } = useParams();
  return <Navigate to={listRoutePath(id, { tab: 'results' })} replace />;
}

function PrivateRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const loading = useSelector(selectAuthLoading);
  const location = useLocation();

  if (loading) return <Loading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function GuestOnlyRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const loading = useSelector(selectAuthLoading);

  if (loading) return <Loading />;
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function PolicyConsentGate() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const needsPrivacy = user?.privacy_policy_agreed === false;
  const needsTerms = user?.terms_agreed === false;
  const open = Boolean(user && (needsPrivacy || needsTerms));

  async function handleAgree() {
    try {
      const updated = await acceptUpdatedPolicies({
        accept_privacy: needsPrivacy,
        accept_terms: needsTerms,
      });
      if (!updated) {
        toast.error('Could not save acknowledgment');
        return;
      }
      dispatch(setUser(updated));
      toast.success('Thanks — you are all set.');
    } catch (e) {
      toast.error(e.message || 'Something went wrong');
    }
  }

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // still clear local auth
    }
    dispatch(clearUser());
    toast.success('Signed out');
    navigate('/login');
  }

  return (
    <PolicyConsentModal
      open={open}
      needsPrivacy={needsPrivacy}
      needsTerms={needsTerms}
      onAgree={handleAgree}
      onSignOut={handleSignOut}
    />
  );
}

function AppShell() {
  useAuth();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('signed_in') !== '1') {
      oauthSignedInToastLatch = false;
      return;
    }
    if (!isAuthenticated) return;

    if (!oauthSignedInToastLatch) {
      oauthSignedInToastLatch = true;
      toast.success('Signed in');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('signed_in');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isAuthenticated]);

  return (
    <div
      className={[
        'flex h-screen min-h-0 flex-col bg-sortable-bg text-sortable-text-primary',
        isAuthenticated ? 'lg:flex-row' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Nav />
      <PolicyConsentGate />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/login"
              element={
                <GuestOnlyRoute>
                  <Login />
                </GuestOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestOnlyRoute>
                  <Register />
                </GuestOnlyRoute>
              }
            />
            <Route path="/discover" element={<Discover />} />
            <Route path="/l/:slug" element={<LegacySlugToListRedirect />} />
            <Route path="/list/:listKey/*" element={<ListPage />} />
            <Route
              path="/lists/new"
              element={
                <PrivateRoute>
                  <CreateList />
                </PrivateRoute>
              }
            />
            <Route
              path="/lists"
              element={
                <PrivateRoute>
                  <ListsPage />
                </PrivateRoute>
              }
            />
            <Route path="/lists/:id/compare" element={<LegacyListCompareRedirect />} />
            <Route path="/lists/:id/results" element={<LegacyListResultsRedirect />} />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <PrivateRoute>
                  <Activity />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <NativeProvider>
      <AppShell />
    </NativeProvider>
  );
}
