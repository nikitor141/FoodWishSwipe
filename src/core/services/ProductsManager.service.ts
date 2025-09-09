import { Singleton } from '@utils/singleton.ts'
import { Product, ProductsService } from '@/api/products.service.ts'

export class ProductsManagerService extends Singleton {
	productsService: ProductsService = ProductsService.instance

	#queue: Product[] = []
	#active: Product[] = []
	#limit: number = 3
	#packetSize: number = 25
	#listeners = new Set()

	protected constructor() {
		super()

		this.#refill()
	}

	#refill = async (): Promise<void> => {
		const products = await this.productsService.getRandomProducts(this.#packetSize - this.#queue.length, {
			categories: [],
			subcategories: [],
			products: []
		})

		this.#queue = [...this.#queue, ...products]
		this.#active = [...this.#active, ...this.#queue.splice(0, this.#limit - this.#active.length)]
		this.#notify()
	}
	getActive() {
		return this.#active
	}
	subscribe(listener) {
		this.#listeners.add(listener)
	}
	#notify() {
		for (const listener of this.#listeners) {
			listener.update()
		}
	}
}
