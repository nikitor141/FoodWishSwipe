export function getAsObject(map: Map<any, any>): {} {
	const obj = {}
	for (let [key, value] of map) {
		obj[key] = value instanceof Map ? getAsObject(value) : value instanceof Set ? Array.from(value) : value
	}
	return obj
}
