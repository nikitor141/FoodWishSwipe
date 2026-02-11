import { DragCustomEvent } from '@core/services/drag.service.ts'
import { NotificationService } from '@core/services/notification.service.ts'
import { ObserverService } from '@core/services/observer.service.ts'
import { Store } from '@core/store/store.ts'
import { ExcludedAPI, ExcludedRuntime } from '@core/types/excluded.types.ts'
import { debounce } from '@utils/debounce.ts'
import { getAsObject } from '@utils/getAsObject.ts'
import { Singleton } from '@utils/singleton.ts'
import { AllCategories, Product, ProductsFetcherService } from '@/api/products-fetcher.service.ts'

export interface ProductsManagerEvents {
	'products-active-add': { product: Product; direction?: DragCustomEvent['detail']['direction'] }
	'products-active-delete': { product: Product; direction?: DragCustomEvent['detail']['direction'] }
	'category-excluded': number
	'subcategory-excluded': number
	'category-included': number
	'subcategory-included': number
}

export type ProductsManagerEvent = {
	[K in keyof ProductsManagerEvents]: { type: K; data: ProductsManagerEvents[K] }
}[keyof ProductsManagerEvents]

export class ProductsManagerService extends Singleton {
	productsFetcherService: ProductsFetcherService = ProductsFetcherService.instance
	notificationService: NotificationService = NotificationService.instance
	observerService: ObserverService = ObserverService.instance
	store: Store = Store.instance

	#activeLimit: number = 3
	#batchSize: number = 25
	#queue: Set<Product> = new Set()
	#active: Set<Product> = new Set()
	#ready: boolean = false
	#pending: boolean = false

	#allCategories: AllCategories | null = null
	#allCategoriesPromise: Promise<AllCategories> | null = null

	#excluded: ExcludedRuntime = {
		categories: new Set(this.store.state.excluded?.categories ?? []),
		subcategories: new Set(this.store.state.excluded?.subcategories ?? []),
		productsBySubcategory: new Map(
			Object.entries(this.store.state.excluded?.productsBySubcategory ?? {}).map(([k, v]) => [+k, new Set(v)])
		),
		products: new Set(this.store.state.excluded?.products ?? [])
	}
	#notify = this.observerService.makeObservable<ProductsManagerEvents>(this, () => this.store.state.screen)

	protected constructor() {
		super()

		void this.#fill()
	}

	getActive() {
		return this.#active
	}

	async getAllCategories() {
		if (this.#allCategories) return this.#allCategories

		if (this.#allCategoriesPromise) return this.#allCategoriesPromise

		this.#allCategoriesPromise = this.productsFetcherService.getAllCategories()
		this.#allCategories = await this.#allCategoriesPromise
		this.#allCategoriesPromise = null

		return this.#allCategories
	}

	getExcluded(): ExcludedAPI {
		return {
			categories: [...this.#excluded.categories],
			subcategories: [...this.#excluded.subcategories],
			products: [...this.#excluded.products]
		}
	}
	getExcludedRuntime(): ExcludedRuntime {
		return this.#excluded
	}

	isReady() {
		return this.#ready
	}

	swipe(product: Product, direction: DragCustomEvent['detail']['direction']) {
		if (direction === 'left') {
			this.#excludeProduct(product)
		}
		if (direction === 'right') {
			this.#addToWishList(product)
		}

		this.#mutateActive('delete', product, direction)

		this.#ensureActiveFilled()
	}

	#mutateActive(prop: 'add' | 'delete', product: Product, direction?: DragCustomEvent['detail']['direction']) {
		this.#active[prop](product)
		this.#notify(`products-active-${prop}`, { product, direction })
	}

	#ensureActiveFilled = debounce(() => {
		if (this.#queue.size <= this.#activeLimit) {
			void this.#refill() // в refill есть вызов refillActive
			return
		}

		this.#refillActive()
	}, 0)

	//todo notification.confirm
	#shouldExcludeSubcategory(subCatId: number) {
		// return this.#excluded.productsBySubcategory.get(subCatId).size % 5 === 0
		return false
		// && confirm('Исключить всю подкатегорию?')
	}

	#shouldExcludeCategory(catId: number) {
		const excludedSubCatsCount = this.#allCategories.categories[catId].subcategoryIds.filter(subCatId =>
			this.#excluded.subcategories.has(subCatId)
		).length // todo убрать filter добавить структуру Map<cat, subCats>
		// return excludedSubCatsCount > 0 && excludedSubCatsCount % 2 === 0
		return excludedSubCatsCount === this.#allCategories.categories[catId].subcategoryIds.length
		// && confirm('Исключить всю категорию?')
	}

	#addToWishList(product: Product) {}

	#excludeProduct({ categoryId, subcategoryId, id }: Product) {
		if (!this.#excluded.productsBySubcategory.has(subcategoryId))
			this.#excluded.productsBySubcategory.set(subcategoryId, new Set())

		let subcategoryProductsSet = this.#excluded.productsBySubcategory.get(subcategoryId)

		subcategoryProductsSet.add(id)
		this.#excluded.products.add(id)

		// Исключаем подкатегорию по условию
		if (this.#shouldExcludeSubcategory(subcategoryId)) {
			this.excludeSubcategory(subcategoryId, categoryId)
		}

		this.#saveExcludedState()
	}

	excludeSubcategory(subCatId: number, catId: number) {
		this.#excluded.subcategories.add(subCatId)
		this.#notify('subcategory-excluded', subCatId)

		this.#purgeProductsBySubcategory(subCatId)

		const activeOrQueueWasFiltered = this.#purgeActiveAndQueueBy('subcategoryId', subCatId)
		if (activeOrQueueWasFiltered) this.#ensureActiveFilled()

		// Исключаем категорию по условию
		if (this.#shouldExcludeCategory(catId)) {
			this.excludeCategory(catId)
		}

		this.#saveExcludedState()
	}

	excludeCategory(catId: number) {
		this.#allCategories.categories[catId].subcategoryIds.forEach(subCatId => {
			// this.#excluded.subcategories.delete(subCatId)

			this.#purgeProductsBySubcategory(subCatId)
			this.includeSubcategory(subCatId, catId)
		})

		this.#excluded.categories.add(catId)
		this.#notify('category-excluded', catId)

		const activeOrQueueWasFiltered = this.#purgeActiveAndQueueBy('categoryId', catId)
		if (activeOrQueueWasFiltered) this.#ensureActiveFilled()

		this.#saveExcludedState()
	}

	includeSubcategory(subCatId: number, catId: number) {
		const categoryWasIncluded = this.includeCategory(catId)
		if (categoryWasIncluded) {
			this.#allCategories.categories[catId].subcategoryIds.forEach(siblingSubCatId => {
				if (siblingSubCatId === subCatId) return
				this.excludeSubcategory(siblingSubCatId, catId)
			})
		}
		// this.includeCategory(catId)

		this.#purgeProductsBySubcategory(subCatId)
		this.#excluded.subcategories.delete(subCatId)

		this.#notify('subcategory-included', subCatId)
		this.#ensureActiveFilled()
		this.#saveExcludedState()
	}

	includeCategory(catId: number) {
		const wasIncluded = this.#excluded.categories.delete(catId)
		if (!wasIncluded) return wasIncluded

		this.#notify('category-included', catId)
		this.#ensureActiveFilled()
		this.#saveExcludedState()

		return wasIncluded
	}

	#saveExcludedState() {
		this.store.debouncedUpdateState('excluded', {
			...this.getExcluded(),
			productsBySubcategory: getAsObject(this.#excluded.productsBySubcategory)
		})
	}

	#purgeProductsBySubcategory(subCatId: number) {
		const productsSet = this.#excluded.productsBySubcategory.get(subCatId)
		if (!productsSet) return

		for (const id of productsSet) {
			this.#excluded.products.delete(id)
		}

		this.#excluded.productsBySubcategory.delete(subCatId)
	}

	#purgeActiveAndQueueBy(prop: 'subcategoryId' | 'categoryId', ref: number): boolean {
		// Подстраховка от мутаций во время итераций
		for (const p of Array.from(this.#queue)) {
			if (p[prop] === ref) {
				this.#queue.delete(p)
			}
		}
		let activeWasFiltered = false
		// Подстраховка от мутаций во время итераций
		for (const p of Array.from(this.#active)) {
			if (p[prop] === ref) {
				this.#mutateActive('delete', p)
				activeWasFiltered = true
			}
		}
		return activeWasFiltered
	}

	async #requestProducts(excluded: ExcludedAPI): Promise<Product[]> {
		try {
			const countToFill = this.#batchSize - this.#queue.size
			if (!countToFill) return []

			return await this.productsFetcherService.getRandomProducts(countToFill, excluded)
		} catch (err) {
			this.notificationService.show(err.message ?? 'Ошибка загрузки', 'negative')
			return []
		}
	}

	async #fill() {
		if (!this.#allCategories) await this.getAllCategories()

		const products: Product[] = await this.#requestProducts(this.getExcluded())
		if (!products.length) this.notificationService.show('Товары закончились. Загляните в фильтры!', 'neutral')
		for (const product of products) {
			if (this.#active.size < this.#activeLimit) {
				this.#mutateActive('add', product)
				continue
			}

			this.#queue.add(product)
		}
		this.#ready = true
	}
	#refillActive() {
		// queue мутирует, поэтому так, чтобы не плодить оберточный array
		while (this.#active.size < this.#activeLimit) {
			const nextProduct = this.#queue.values().next().value
			if (!nextProduct) break

			this.#queue.delete(nextProduct)

			this.#mutateActive('add', nextProduct)
		}
	}

	async #refill() {
		if (this.#pending) return
		this.#pending = true

		const products: Product[] = await this.#requestProducts(this.getExcluded())
		if (!products.length) this.notificationService.show('Товары закончились. Загляните в фильтры!', 'neutral')
		for (const product of products) {
			this.#queue.add(product)
		}
		this.#pending = false

		this.#refillActive()
	}
}
