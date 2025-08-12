import { PRODUCT_BY_ID_URL, RANDOM_PRODUCT_URL, SERVER_URL } from '@/config/url.config'

interface Product {
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
interface Excluded {
	categories: number[]
	subcategories: number[]
	products: number[]
}
type RandomProductsArgs = { count: number; excluded: Excluded }
type ProductByIdArgs = { id: number }

export class ProductsService {
	#randomFetcher = new RandomProductsFetcher()
	#byIdFetcher = new ProductByIdFetcher()
	async getRandomProducts(count: number, excluded: Excluded): Promise<Product[]> {
		return await this.#randomFetcher.fetchData({ count, excluded })
	}

	async getProductById(id: number): Promise<Product> {
		return await this.#byIdFetcher.fetchData({ id })
	}
}

abstract class BaseFetcher<T> {
	abstract prepareFetchArgs(rawFetchArgs: T): [string, RequestInit?]

	async fetchData(rawFetchArgs: T) {
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
