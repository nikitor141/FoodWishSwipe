import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { DragCustomEvent } from '@core/services/drag.service.ts'
import { NotificationService } from '@core/services/notification.service.ts'
import { Singleton } from '@utils/singleton.ts'
import { Excluded, Product, ProductsFetcherService } from '@/api/products-fetcher.service.ts'

interface Listener {
	refill(type: 'add' | 'delete', product: Product): void
}
interface ExcludedProduct {
	id: Product['id']
	cat: Product['categoryId']
	subCat: Product['subcategoryId']
}

export class ProductsManagerService extends Singleton {
	productsFetcherService: ProductsFetcherService = ProductsFetcherService.instance
	notificationService: NotificationService = NotificationService.instance

	#activeLimit: number = 3
	#batchSize: number = 25
	#queue: Set<Product> = new Set()
	#active: Set<Product> = new Set()
	#listeners: Set<Listener> = new Set()

	#productCardsByProduct: WeakMap<Product, ProductCard> = new WeakMap()
	#subcategoriesByCategory: Map<ExcludedProduct['cat'], Set<ExcludedProduct['subCat']>> = new Map()
	#productsExcluded: Map<ExcludedProduct['id'], ExcludedProduct> = new Map()
	#subcategoriesExcluded: Map<
		ExcludedProduct['subCat'],
		{ subCat: ExcludedProduct['subCat']; cat: ExcludedProduct['cat'] }
	> = new Map()
	#categoriesExcluded: Set<ExcludedProduct['cat']> = new Set()
	#subcategoryCounter: Map<ExcludedProduct['subCat'], { products: Set<ExcludedProduct['id']> }> = new Map()
	#categoryCounter: Map<ExcludedProduct['cat'], { subCats: Set<ExcludedProduct['subCat']> }> = new Map()

	protected constructor() {
		super()
		void this.#fill()
	}

	subscribe(listener: Listener) {
		this.#listeners.add(listener)
	}

	getActive() {
		return this.#active
	}

	addProductCard(product: Product, productCard: ProductCard): void {
		this.#productCardsByProduct.set(product, productCard)
	}

	swipe(productCard: ProductCard, direction: DragCustomEvent['detail']['direction']) {
		if (direction === 'left') {
			this.#produceExclude(productCard)
		}

		this.#active.delete(productCard.product)
		productCard.destroy()

		if (this.#queue.size <= this.#activeLimit) void this.#refill()
		this.#refillActive()
	}

	#produceExclude(productCard: ProductCard) {
		const { id, subcategoryId: subCat, categoryId: cat } = productCard.product

		// Записываем продукт в id индекс
		this.#productsExcluded.set(id, { id, subCat, cat })
		// Записываем подкатегорию в cat индекс
		if (!this.#subcategoriesByCategory.has(cat)) this.#subcategoriesByCategory.set(cat, new Set())
		this.#subcategoriesByCategory.get(cat).add(subCat)
		// Считаем подкатегории
		if (!this.#subcategoryCounter.has(subCat)) this.#subcategoryCounter.set(subCat, { products: new Set() })
		const subCatCounter = this.#subcategoryCounter.get(subCat)
		subCatCounter.products.add(id)

		// Проверяем количество товаров
		if (subCatCounter.products.size !== 5) return

		// Очищаем все продукты этой подкатегории
		this.#clearProductsBySubcategory(subCat)
		// Записываем подкатегорию в subCat индекс
		this.#subcategoriesExcluded.set(subCat, { subCat, cat })
		// Считаем категории
		if (!this.#categoryCounter.has(cat)) this.#categoryCounter.set(cat, { subCats: new Set() })
		const catCounter = this.#categoryCounter.get(cat)
		catCounter.subCats.add(subCat)

		// Проверяем количество подкатегорий
		if (catCounter.subCats.size !== 2) return

		// Очищаем все подкатегории и продукты категории
		this.#clearSubcategoriesByCategory(cat)
		// Записываем категорию в исключённые
		this.#categoriesExcluded.add(cat)
	}

	#clearProductsBySubcategory(subCat: ExcludedProduct['subCat']) {
		// Удаляем ВСЕ продукты, которые вообще встречались в этой подкатегории, если не были удалены ранее
		const subCatData = this.#subcategoryCounter.get(subCat)
		if (subCatData) {
			for (const productId of subCatData.products) {
				this.#productsExcluded.delete(productId)
			}
			// Удаляем подкатегорию из счетчика
			this.#subcategoryCounter.delete(subCat)
		}

		// Удаляем из очереди и активных
		if (this.#purgeActiveAndQueueBy('subcategoryId', subCat)) this.#refillActive()
	}

	#clearSubcategoriesByCategory(cat: ExcludedProduct['cat']) {
		//  Удаляем ВСЕ подкатегории, которые вообще встречались в этой категории
		const allSubCats = this.#subcategoriesByCategory.get(cat)
		for (const subCat of allSubCats) {
			this.#subcategoriesExcluded.delete(subCat)
			this.#clearProductsBySubcategory(subCat)
		}
		// Удаляем саму запись категории
		this.#subcategoriesByCategory.delete(cat)
		this.#categoryCounter.delete(cat)

		// Удаляем из очереди и активных
		if (this.#purgeActiveAndQueueBy('categoryId', cat)) this.#refillActive()
	}

	#purgeActiveAndQueueBy(
		prop: 'subcategoryId' | 'categoryId',
		ref: ExcludedProduct['subCat'] | ExcludedProduct['cat']
	): boolean {
		for (const p of Array.from(this.#queue)) {
			if (p[prop] === ref) {
				this.#queue.delete(p)
			}
		}
		let activeWasFiltered = false
		// Из-за мутаций во время итераций подстраховался
		for (const p of Array.from(this.#active)) {
			if (p[prop] === ref) {
				this.#active.delete(p)
				this.#productCardsByProduct.get(p).destroy()
				activeWasFiltered = true
			}
		}
		return activeWasFiltered
	}

	getExcluded(): Excluded {
		return {
			categories: Array.from(this.#categoriesExcluded),
			subcategories: Array.from(this.#subcategoriesExcluded.keys()),
			products: Array.from(this.#productsExcluded.keys())
		}
	}

	async #requestProducts(): Promise<Product[]> {
		try {
			const countToFill = this.#batchSize - this.#queue.size
			if (!countToFill) return []

			return await this.productsFetcherService.getRandomProducts(countToFill, this.getExcluded())
		} catch (err) {
			this.notificationService.show(err.message ?? 'Ошибка загрузки', 'negative')
			return []
		}
	}

	async #fill() {
		const products: Product[] = await this.#requestProducts()

		for (const product of products) {
			if (this.#active.size < this.#activeLimit) {
				this.#active.add(product)
				this.#notify('add', product)
				continue
			}

			this.#queue.add(product)
		}
	}
	#refillActive() {
		const nextProduct = this.#queue.values().next().value
		if (!nextProduct) return
		this.#queue.delete(nextProduct)

		if (this.#active.size === this.#activeLimit) return

		this.#active.add(nextProduct)
		this.#notify('add', nextProduct)
	}

	async #refill() {
		const products: Product[] = await this.#requestProducts()

		for (const product of products) {
			this.#queue.add(product)
		}
	}

	#notify(...args: Parameters<Listener['refill']>) {
		for (const listener of this.#listeners) {
			listener.refill(...args)
		}
	}
}
