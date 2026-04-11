import { createClient } from '@supabase/supabase-js'

import { SUPABASE_API_KEY, SUPABASE_URL } from '@/config/url.config'
import { NotificationService } from '@/core/services/notification.service'
import { ExcludedAPI } from '@/core/types/excluded.types.ts'
import { Singleton } from '@/utils/singleton'

export interface Product {
	category_id: number
	category_name: string
	id: number
	image: string
	name: string
	price: number
	subcategory_id: number
	subcategory_name: string
	url: string
}
export interface Category {
	name: string
	id: number
	slug: string
	subcategory_ids: number[]
}

export interface Subcategory {
	category_id: number
	id: number
	name: string
}

export interface AllCategories {
	categories: Record<Category['id'], Category>
	subcategories: Record<Subcategory['id'], Subcategory>
}

export class ProductsFetcherService extends Singleton {
	#notificationService: NotificationService = NotificationService.instance
	#supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY)

	protected constructor() {
		super()
	}

	async getRandomProducts(count: number, excluded: ExcludedAPI) {
		const { data, error } = await this.#supabase
			.rpc('random_products', {
				excluded_categories: excluded.categories,
				excluded_products: excluded.products,
				excluded_subcategories: excluded.subcategories,
				limit_count: count
			})
			.overrideTypes<Product[]>()
		if (error) this.#notificationService.show(error.message, 'negative')
		else return data
	}

	async getProductById(id: number) {
		const { data, error } = await this.#supabase
			.from('products_with_names')
			.select()
			.eq('id', id)
			.single()
			.overrideTypes<Product>()
		if (error) this.#notificationService.show(error.message, 'negative')
		else return data
	}

	async getAllCategories() {
		let { data, error } = await this.#supabase.rpc('get_all_categories').overrideTypes<AllCategories>()
		if (error) this.#notificationService.show(error.message, 'negative')
		else return data
	}
}
