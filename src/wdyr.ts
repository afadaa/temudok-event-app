// why-did-you-render setup (development only)
// Install with: npm install @welldone-software/why-did-you-render --save-dev
// This file is safe to import conditionally in development builds.
declare global {
  interface Window { DEBUG?: boolean }
}

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const why = require('@welldone-software/why-did-you-render');
  const React = require('react');
  why(React, {
    trackAllPureComponents: true,
  });
  console.info('why-did-you-render enabled');
}
