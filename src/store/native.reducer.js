import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isNative: false,
  platform: 'web',
  keyboardVisible: false,
  deviceInfo: null,
};

const nativeSlice = createSlice({
  name: 'native',
  initialState,
  reducers: {
    setNativeInfo: (state, action) => {
      state.isNative = action.payload.isNative;
      state.platform = action.payload.platform;
      state.deviceInfo = action.payload.deviceInfo;
    },
    setKeyboardVisible: (state, action) => {
      state.keyboardVisible = action.payload;
    },
  },
});

export const { setNativeInfo, setKeyboardVisible } = nativeSlice.actions;

export const selectIsNative = (state) => state.native.isNative;
export const selectPlatform = (state) => state.native.platform;
export const selectKeyboardVisible = (state) => state.native.keyboardVisible;
export const selectDeviceInfo = (state) => state.native.deviceInfo;

export default nativeSlice.reducer;
