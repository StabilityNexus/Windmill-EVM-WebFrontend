module.exports = {
  ci: {
    collect: {
      // startServerCommand: 'npm run start',   // for SSR/dynamic routes
      // url: ['http://localhost:3000'],         // Future: test multiple routes/ports.
      // numberOfRuns: 3,                        // Future: average across runs for stability
      output: ['html', 'json'],
      outputPath: '.lighthouseci/',
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/',
    },
    // assert: {                                 // enforce score budgets
    //   assertions: {
    //     'categories:performance': ['warn', { minScore: 0.9 }],
    //     'categories:accessibility': ['error', { minScore: 0.9 }],
    //     'categories:seo': ['warn', { minScore: 0.8 }],
    //   },
    // },
  },
};