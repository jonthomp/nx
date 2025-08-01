/* eslint-disable @nx/enforce-module-boundaries */
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-docs'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  viteFinal: async (config) => {
    const {
      nxViteTsPaths,
      // nx-ignore-next-line
    } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');
    return mergeConfig(config, {
      plugins: [nxViteTsPaths()],
    });
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },

  docs: {},
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
