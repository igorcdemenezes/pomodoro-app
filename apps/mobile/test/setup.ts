// Built-in matchers ship with @testing-library/react-native 12.4+; the separate
// extend-expect entry point no longer exists.
// NetInfo talks to a native module that does not exist under Jest.
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
