import { ExcludedAPI } from '@core/types/excluded.types.ts'
import { Singleton } from '@utils/singleton'
import { ALL_CATEGORIES_URL, PRODUCT_BY_ID_URL, RANDOM_PRODUCT_URL, SERVER_URL } from '@/config/url.config'

export interface Product {
	categoryId: number
	categoryName: string
	id: number
	image: string
	name: string
	price: number
	subcategoryId: number
	subcategoryName: string
	url: string
}
export interface Category {
	name: string
	id: number
	slug: string
	subcategoryIds: number[]
}

export interface Subcategory {
	categoryId: number
	id: number
	name: string
}

export interface AllCategories {
	categories: Record<Category['id'], Category>
	subcategories: Record<Subcategory['id'], Subcategory>
}

type RandomProductsArgs = { count: number; excluded: ExcludedAPI }
type ProductByIdArgs = { id: number }

export class ProductsFetcherService extends Singleton {
	protected constructor() {
		super()
	}

	#randomFetcher = new RandomProductsFetcher()
	#byIdFetcher = new ProductByIdFetcher()
	#allCategoriesFetcher = new AllCategoriesFetcher()

	async getRandomProducts(count: number, excluded: ExcludedAPI): Promise<Product[]> {
		return await this.#randomFetcher.fetchData({ count, excluded })
	}

	async getProductById(id: number): Promise<Product> {
		return await this.#byIdFetcher.fetchData({ id })
	}

	async getAllCategories(): Promise<AllCategories> {
		return await this.#allCategoriesFetcher.fetchData()
	}
}

abstract class BaseFetcher<T> {
	abstract prepareFetchArgs(rawFetchArgs: T): [string, RequestInit?]

	async fetchData(rawFetchArgs?: T) {
		const finalArgs = this.prepareFetchArgs(rawFetchArgs)

		const response = await fetch(...finalArgs)
		if (!response.ok) throw new Error(response.statusText)

		return await response.json()
	}
}

class RandomProductsFetcher extends BaseFetcher<RandomProductsArgs> {
	prepareFetchArgs({ count, excluded }: RandomProductsArgs): [string, RequestInit?] {
		return [
			SERVER_URL + RANDOM_PRODUCT_URL,
			{
				method: 'POST',
				body: JSON.stringify({
					count,
					excluded
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			}
		]
	}
}
class ProductByIdFetcher extends BaseFetcher<ProductByIdArgs> {
	prepareFetchArgs({ id }: ProductByIdArgs): [string, RequestInit?] {
		return [SERVER_URL + PRODUCT_BY_ID_URL + id]
	}
}
class AllCategoriesFetcher extends BaseFetcher<AllCategoriesFetcher> {
	prepareFetchArgs(): [string, RequestInit?] {
		return [SERVER_URL + ALL_CATEGORIES_URL, { method: 'GET' }]
	}
}
