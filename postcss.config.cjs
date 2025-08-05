module.exports = {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
    ...(process.env.NODE_ENV === 'production' && {
      '@fullhuman/postcss-purgecss': {
        content: [
          './client/index.html',
          './client/src/**/*.{js,jsx,ts,tsx}',
        ],
        safelist: [
          // Preserve essential Radix UI classes
          /^rdp-/,
          /^data-radix-/,
          'opacity-0',
          'opacity-100',
          'bg-oficaz-primary',
          'loaded',
          'loading-spinner',
          // Preserve dynamic classes
          /^bg-(blue|emerald|purple|orange)-500$/,
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
      },
      'cssnano': {
        preset: ['default', {
          discardComments: { removeAll: true },
          normalizeWhitespace: true,
          minifySelectors: true,
          minifyFontValues: true,
          minifyParams: true,
          colormin: true,
          calc: true,
          convertValues: true,
          discardDuplicates: true,
          discardEmpty: true,
          discardOverridden: true,
          mergeIdents: true,
          mergeLonghand: true,
          mergeRules: true,
          normalizeCharset: true,
          normalizeDisplayValues: true,
          normalizePositions: true,
          normalizeRepeatStyle: true,
          normalizeString: true,
          normalizeTimingFunctions: true,
          normalizeUnicode: true,
          normalizeUrl: true,
          orderedValues: true,
          reduceIdents: true,
          reduceInitial: true,
          reduceTransforms: true,
          svgo: true,
          uniqueSelectors: true,
        }]
      }
    })
  }
}