import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Skip the VPN handshake polling loop in tests (no real WireGuard tunnel).
    // pushConfigExecutor reads these env vars: PUSH_VPN_WAIT_MS / PUSH_VPN_POLL_MS.
    // Setting both to 0 makes the loop exit immediately on first check.
    testEnvironmentOptions: {
        env: {
            PUSH_VPN_WAIT_MS: '0',
            PUSH_VPN_POLL_MS: '0',
        },
    },
    setupFiles: ['<rootDir>/jest.setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setupAfterEnv.ts'],
    globalTeardown: '<rootDir>/jest.globalTeardown.ts',
    roots: ['<rootDir>/src/__tests__', '<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                module: 'CommonJS',
                moduleResolution: 'node',
                paths: { '@/*': ['./src/*'] },
            },
        }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    clearMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/lib/**/*.ts',
        '!src/lib/prisma.ts',
        '!src/lib/email.ts',
        '!src/lib/queue.ts',
    ],
    coverageThreshold: {
        global: {
            statements: 70,
            branches:   60,
            functions:  70,
            lines:      70,
        },
    },
};

export default config;
