import { ImagesStore } from '@core/store/images.store'

export function imgToPicture(tag: HTMLImageElement): HTMLPictureElement {
	const imageStore: ImagesStore = ImagesStore.instance
	const { original, avif, webp, w, h } = imageStore.images[tag.dataset.src]

	const template = document.createElement('template')
	template.innerHTML = `
	   <picture>
				<source srcset="${avif}" type="image/avif"></source>
				<source srcset="${webp}" type="image/webp"></source>
				<img src="${original}" width="${w}" height="${h}" loading="lazy" alt="${tag.alt || original.split('/').at(-1)}">
		</picture>
	`.trim()

	return template.content.firstElementChild as HTMLPictureElement
}
