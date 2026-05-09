import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        include: ['tests/**/*.spec.js', 'tests/**/*.test.js', 'src/**/*.spec.js'],
        fileParallelism: false, // Prevents tests from colliding on the same port/DB instance
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/setup.js']
        }
    }
});
