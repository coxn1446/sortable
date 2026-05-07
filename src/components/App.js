import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { listRoutePath } from '../helpers/listRoutePaths';
import { fetchListBySlug } from '../helpers/listHelpers';
import { NativeProvider } from '../utils/NativeContext';
import { useAuth } from '../hooks/useAuth';
import { selectIsAuthenticated, selectAuthLoading } from '../store/auth.reducer';
import Nav from './Nav/Nav';
import Loading from './Loading/Loading';

const Home = lazy(() => import('../routes/Home'));
const Login = lazy(() => import('../routes/Login'));
const Register = lazy(() => import('../routes/Register'));
const Profile = lazy(() => import('../routes/Profile'));
const NotFound = lazy(() => import('../routes/NotFound'));
const CreateList = lazy(() => import('../routes/CreateList'));
const ListPage = lazy(() => import('../routes/ListPage'));
const Discover = lazy(() => import('../routes/Discover'));
const Activity = lazy(() => import('../routes/Activity'));
const ListsPage = lazy(() => import('../routes/ListsPage'));

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

function AppShell() {
  useAuth();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-sortable-bg text-sortable-text-primary lg:flex-row">
      <Nav />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
