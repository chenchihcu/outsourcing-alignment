import { defineConfig, devices } from '@playwright/test';

const iPadUA = devices['iPad Pro 11']?.userAgent || 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const iPhoneBase = devices['iPhone 16 Pro Max'] || devices['iPhone 14 Pro Max'] || devices['iPhone 13 Pro Max'];
const iPhoneLandscape = devices['iPhone 16 Pro Max landscape'] || devices['iPhone 14 Pro Max landscape'] || devices['iPhone 13 Pro Max landscape'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'tablet-portrait-820',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: iPadUA,
      },
    },
    {
      name: 'tablet-landscape-1180',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: iPadUA,
      },
    },
    {
      name: 'phone-portrait-440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 440, height: 956 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: iPhoneBase?.userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      },
    },
    {
      name: 'phone-landscape-956',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 956, height: 440 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: iPhoneLandscape?.userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      },
    },
  ],
});
