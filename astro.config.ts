import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import swup from '@swup/astro'
import robotsTxt from 'astro-robots-txt'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'
import devtoolsJson from 'vite-plugin-devtools-json'
import { remarkCaptions } from './src/plugins/remarkCaptions'
import { remarkCitations } from './src/plugins/remarkCitations'
import { remarkMathDelimiters } from './src/plugins/remarkMathDelimiters'

// https://astro.build/config
export default defineConfig({
  site: 'https://oyvindsung.github.io',
  prefetch: true,
  base: '/',
  vite: {
    plugins: [
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-ignore
      devtoolsJson(),
    ],
  },
  markdown: {
    remarkPlugins: [
      remarkMathDelimiters,
      remarkCaptions,
      remarkCitations,
    ],
    shikiConfig: {
      theme: 'dracula',
      wrap: true,
    },
  },
  integrations: [
    UnoCSS({ injectReset: true }),
    mdx({}),
    robotsTxt(),
    sitemap(),
    swup({
      theme: false,
      animationClass: 'transition-swup-',
      cache: true,
      preload: true,
      accessibility: true,
      smoothScrolling: true,
      updateHead: true,
      updateBodyClass: true,
    }),
  ],
})
