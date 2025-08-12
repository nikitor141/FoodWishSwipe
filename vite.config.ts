import autoprefixer from 'autoprefixer'
import path from 'path'
import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'
import webfontDownload from 'vite-plugin-webfont-dl'

export default defineConfig(() => {
	return {
		resolve: {
			alias: {
				'@': path.resolve('/src')
			}
		},
		plugins: [imagetools(), webfontDownload()],
		css: {
			postcss: {
				plugins: [autoprefixer()]
			}
		}
	}
})
