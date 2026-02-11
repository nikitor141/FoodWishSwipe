export interface ExcludedAPI {
	categories: number[]
	subcategories: number[]
	products: number[]
}

export interface ExcludedRuntime {
	categories: Set<number>
	subcategories: Set<number>
	products: Set<number>
	productsBySubcategory: Map<number, Set<number>>
}

export interface ExcludedSerialized {
	categories: number[]
	subcategories: number[]
	products: number[]
	productsBySubcategory: Record<string, number[]>
}
