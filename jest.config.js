module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'client',
      rootDir: __dirname,
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src'],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
      },
      transformIgnorePatterns: ['/node_modules/(?!(@ionic|@stencil|ionicons)/)'],
      testPathIgnorePatterns: ['/node_modules/', '/build/'],
    },
    {
      displayName: 'server',
      rootDir: __dirname,
      testEnvironment: 'node',
      roots: ['<rootDir>/server'],
      transformIgnorePatterns: ['/node_modules/'],
      testPathIgnorePatterns: ['/node_modules/', '/build/'],
    },
  ],
};
