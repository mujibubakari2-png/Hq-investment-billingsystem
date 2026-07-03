import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setupAfterEnv.ts'],
    globalTeardown: '<rootDir>/jest.globalTeardown.ts',
    roots: ['<rootDir>/src/__tests__'],
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
