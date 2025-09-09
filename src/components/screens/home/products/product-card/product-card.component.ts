import { Component } from '@core/component/component.ts'
import { RenderService } from '@core/services/render.service.ts'
import { Product } from '@/api/products.service.ts'
import styles from './product-card.module.scss'
import template from './product-card.template.html?raw'

export class ProductCard implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance

	id: Product['id']
	url: Product['url']
	name: Product['name']
	image: Product['image']
	price: Product['price']
	categoryId: Product['categoryId']
	categoryName: Product['categoryName']
	subcategoryId: Product['subcategoryId']
	subcategoryName: Product['subcategoryName']

	constructor(product: Product) {
		this.id = product.id
		this.url = product.url
		this.name = product.name
		this.image = product.image
		this.price = product.price
		this.categoryId = product.categoryId
		this.categoryName = product.categoryName
		this.subcategoryId = product.subcategoryId
		this.subcategoryName = product.subcategoryName
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		const subcategoryEl: HTMLSpanElement = this.element.querySelector(`.${styles['product-card__tag-subcategory']}`)
		const categoryEl: HTMLSpanElement = this.element.querySelector(`.${styles['product-card__tag-category']}`)
		const nameLinkEl: HTMLAnchorElement = this.element.querySelector(`.${styles['product-card__name']} a`)
		const linkEl: HTMLAnchorElement = this.element.querySelector(`.${styles['product-card__image']}`)
		const priceMainEl = this.element.querySelector(`.${styles['product-card__price']} span`)
		const pricePennyEl = this.element.querySelector(`.${styles['product-card__price']} sup`)
		const imgEl: HTMLImageElement = linkEl.querySelector('img')

		const price = this.price.toString().split('.')
		const priceMain = price[0]
		const pricePenny = price[1]

		subcategoryEl.textContent = this.subcategoryName
		categoryEl.textContent = this.categoryName
		nameLinkEl.textContent = this.name
		nameLinkEl.href = this.url
		linkEl.href = this.url
		priceMainEl.textContent = priceMain
		pricePennyEl.textContent = pricePenny
		imgEl.src = this.image

		return this.element
	}
}
