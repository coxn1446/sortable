import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth.reducer';
import globalReducer from './global.reducer';
import nativeReducer from './native.reducer';
import listsReducer from './lists.reducer';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    global: globalReducer,
    native: nativeReducer,
    lists: listsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ['global.activeModal'],
        ignoredActionPaths: ['payload.data.onConfirm', 'payload.data.onCancel'],
      },
    }),
});

export default store;
