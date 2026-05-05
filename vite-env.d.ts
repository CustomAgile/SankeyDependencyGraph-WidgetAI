/// <reference types="vite/client" />

/**
 * Compile-time mock flag injected by Vite define.
 * - true  → always use mock data
 * - false → always use live Rally data
 * - undefined → runtime decision (mock unless ?live=true)
 */
declare const __USE_MOCK__: boolean | undefined;

/**
 * App version string injected at build time: "<version>-<build>".
 */
declare const __APP_VERSION__: string;
