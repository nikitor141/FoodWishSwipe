import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { DragCustomEvent } from '@core/services/drag.service.ts'
import { NotificationService } from '@core/services/notification.service.ts'
import { Singleton } from '@utils/singleton.ts'
import { Excluded, Product, ProductsService } from '@/api/products.service.ts'

interface Listener {
	refill(type: 'push' | 'shift', product: Product): void
}

export class ProductsManagerService extends Singleton {
	productsService: ProductsService = ProductsService.instance
	notificationService: NotificationService = NotificationService.instance

	#queue: Product[] = []
	#active: Product[] = []
	#limit: number = 3
	#packetSize: number = 25
	#listeners: Set<Listener> = new Set()
	#excludedRaw: Map<Product['categoryId'], Map<Product['subcategoryId'], Set<Product['id']>>> = new Map()
	#excludedTemp: {
		categories: Set<Product['categoryId']>
		subcategories: Set<Product['subcategoryId']>
		products: Set<Product['id']>
	} = { categories: new Set(), subcategories: new Set(), products: new Set() }

	protected constructor() {
		super()
		void this.#fill()
	}

	getActive() {
		return this.#active
	}

	subscribe(listener: Listener) {
		this.#listeners.add(listener)
	}

	swipe(productCard: ProductCard, direction: DragCustomEvent['detail']['direction']) {
		this.#active.shift()
		productCard.destroy()

		if (this.#queue.length <= this.#limit) void this.#refill()

		const nextProduct = this.#queue.shift()
		if (!nextProduct) return

		this.#active.push(nextProduct)
		this.#notify('push', nextProduct)

		if (direction === 'left') {
			const catId = productCard.categoryId
			const subcatId = productCard.subcategoryId
			const prodId = productCard.id
			this.#excludedTemp.products.add(prodId)

			if (!this.#excludedRaw.has(catId)) {
				this.#excludedRaw.set(catId, new Map([['excludedSubcats', new Set()]]))
			}
			const subcats = this.#excludedRaw.get(catId)
			if (!subcats.has(subcatId)) {
				subcats.set(subcatId, new Set())
			}

			const products = subcats.get(subcatId)
			products.add(prodId)

			const excludedSubcats = subcats.get('excludedSubcats')

			if (products.size > 0 && products.size % 5 === 0) {
				excludedSubcats.add(subcatId)

				for (const excludedSubcat of excludedSubcats) {
					if (!subcats.has(excludedSubcat)) continue

					for (const product of subcats.get(excludedSubcat)) {
						this.#excludedTemp.products.delete(product)
						products.delete(product)
						this.#queue = this.#queue.filter(p => p.id !== product)
						this.#active = this.#active.filter(p => p.id !== product)
						console.log('After filtering:\n',this.#queue, '\n', this.#active)
					}
				}
				subcats.delete(subcatId)

				this.#excludedTemp.subcategories.add(subcatId)
				console.log('\n')
			}
			if (excludedSubcats.size > 0 && excludedSubcats.size % 2 === 0) {
				for (const excludedSubcat of excludedSubcats) {
					this.#excludedTemp.subcategories.delete(excludedSubcat)
					for (const [key, productSet] of subcats) {
						if (key !== 'excludedSubcats') {
							for (const product of productSet) {
								this.#excludedTemp.products.delete(product)
								this.#queue = this.#queue.filter(p => p.id !== product)
								this.#active = this.#active.filter(p => p.id !== product)
							}
						}
					}
				}
				this.#excludedRaw.delete(catId)

				this.#excludedTemp.categories.add(catId)
				console.log('\n')
			}
		}
	}

	getExcluded() {
		return {
			categories: Array.from(this.#excludedTemp.categories),
			subcategories: Array.from(this.#excludedTemp.subcategories),
			products: Array.from(this.#excludedTemp.products)
		}
	}

	async #requestProducts(): Promise<Product[]> {
		try {
			const countToFill = this.#packetSize - this.#queue.length
			if (!countToFill) return []

			return await this.productsService.getRandomProducts(countToFill, this.getExcluded())
		} catch (err) {
			this.notificationService.show(err.message ?? 'Ошибка загрузки', 'negative')
			return []
		}
	}

	async #fill() {
		const products: Product[] = await this.#requestProducts()

		for (const product of products) {
			if (this.#active.length < this.#limit) {
				this.#active.push(product)
				this.#notify('push', product)
				continue
			}

			this.#queue.push(product)
		}
	}

	async #refill() {
		const products: Product[] = await this.#requestProducts()

		for (const product of products) {
			this.#queue.push(product)
		}
	}

	#notify(...args: Parameters<Listener['refill']>) {
		for (const listener of this.#listeners) {
			listener.refill(...args)
		}
	}
}
