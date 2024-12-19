import { defineConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import prism from 'markdown-it-prism'
import anchor from 'markdown-it-anchor'
import toc from 'markdown-it-toc-done-right'

export default defineConfig({
  plugins: [
    Markdown({
      markdownItOptions: {
        html: true,
        linkify: true,
        typographer: true,
      },
      markdownItSetup(md) {
        md.use(prism)
        md.use(anchor)
        md.use(toc)
      },
      wrapperComponent: 'div',
      wrapperClasses: 'markdown-body'
    })
  ],
  css: {
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('tailwindcss'),
      ]
    }
  }
})