/**
 * Type Safety Utilities
 *
 * Helper functions to ensure safe array and string operations
 * Prevents frontend crashes by validating data types before processing
 */

/**
 * Safely get an array from any input
 * @param input - Any input that should be an array
 * @param defaultValue - Default array to return if input is not a valid array
 * @returns Valid array or default value
 */
export function getArray<T = any>(input: any, defaultValue: T[] = []): T[] {
  if (Array.isArray(input)) {
    return input;
  }

  // Handle null/undefined
  if (input === null || input === undefined) {
    return defaultValue;
  }

  // Handle string that could be JSON array
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  // Handle objects that could be converted to arrays
  if (typeof input === 'object') {
    return Object.values(input);
  }

  return defaultValue;
}

/**
 * Safely get a string from any input
 * @param input - Any input that should be a string
 * @param defaultValue - Default string to return if input is not valid
 * @returns Valid string or default value
 */
export function getString(input: any, defaultValue: string = ''): string {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return defaultValue;
  }

  // Return as-is if already a string
  if (typeof input === 'string') {
    return input;
  }

  // Convert numbers to string
  if (typeof input === 'number') {
    return input.toString();
  }

  // Convert boolean to string
  if (typeof input === 'boolean') {
    return input.toString();
  }

  // Convert objects to JSON string
  if (typeof input === 'object') {
    try {
      return JSON.stringify(input);
    } catch {
      return defaultValue;
    }
  }

  // Fallback: convert anything to string
  try {
    return String(input);
  } catch {
    return defaultValue;
  }
}

/**
 * Safely get a number from any input
 * @param input - Any input that should be a number
 * @param defaultValue - Default number to return if input is not valid
 * @returns Valid number or default value
 */
export function getNumber(input: any, defaultValue: number = 0): number {
  if (typeof input === 'number' && !isNaN(input)) {
    return input;
  }

  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    return !isNaN(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

/**
 * Safely map over an array with type checking
 * @param array - Input that should be an array
 * @param mapper - Mapping function
 * @param defaultValue - Default value if array is invalid
 * @returns Mapped array or default value
 */
export function safeMap<T, U>(
  array: any,
  mapper: (item: T, index: number) => U,
  defaultValue: U[] = []
): U[] {
  const safeArray = getArray<T>(array, [] as T[]);
  return safeArray.map(mapper);
}

/**
 * Safely filter an array with type checking
 * @param array - Input that should be an array
 * @param predicate - Filter function
 * @param defaultValue - Default value if array is invalid
 * @returns Filtered array or default value
 */
export function safeFilter<T>(
  array: any,
  predicate: (item: T, index: number, array: T[]) => boolean,
  defaultValue: T[] = []
): T[] {
  const safeArray = getArray<T>(array, defaultValue);
  return safeArray.filter(predicate);
}

/**
 * Safely reduce an array with type checking
 * @param array - Input that should be an array
 * @param reducer - Reduce function
 * @param initialValue - Initial value for reduction
 * @returns Reduced value or initial value if array is invalid
 */
export function safeReduce<T, U>(
  array: any,
  reducer: (accumulator: U, item: T, index: number, array: T[]) => U,
  initialValue: U
): U {
  const safeArray = getArray<T>(array);
  return safeArray.reduce(reducer, initialValue);
}

/**
 * Safely access array element at index
 * @param array - Input that should be an array
 * @param index - Index to access
 * @param defaultValue - Default value if index is out of bounds
 * @returns Array element or default value
 */
export function safeArrayAccess<T>(
  array: any,
  index: number,
  defaultValue: T | null = null
): T | null {
  const safeArray = getArray<T>(array);
  if (index < 0 || index >= safeArray.length) {
    return defaultValue;
  }
  return safeArray[index] ?? defaultValue;
}

/**
 * Safely access object property with type checking
 * @param obj - Object to access property from
 * @param key - Property key to access
 * @param defaultValue - Default value if property doesn't exist
 * @returns Property value or default value
 */
export function safePropertyAccess<T = any>(
  obj: any,
  key: string,
  defaultValue: T | null = null
): T | null {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  return obj[key] ?? defaultValue;
}

/**
 * Type guard to check if input is a valid coordinate array
 * @param coords - Input to validate
 * @returns True if input is a valid coordinate array
 */
export function isValidCoordinateArray(coords: any): coords is number[][] {
  if (!Array.isArray(coords)) {
    return false;
  }

  return coords.every(coord =>
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    !isNaN(coord[0]) &&
    !isNaN(coord[1])
  );
}

/**
 * Type guard to check if input is a valid amenity object
 * @param amenity - Input to validate
 * @returns True if input is a valid amenity object
 */
export function isValidAmenity(amenity: any): amenity is {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distance?: number;
} {
  return (
    amenity &&
    typeof amenity.id === 'string' &&
    typeof amenity.name === 'string' &&
    typeof amenity.category === 'string' &&
    typeof amenity.lat === 'number' &&
    typeof amenity.lon === 'number' &&
    !isNaN(amenity.lat) &&
    !isNaN(amenity.lon)
  );
}

/**
 * Type guard to check if input is a valid property object
 * @param property - Input to validate
 * @returns True if input is a valid property object
 */
export function isValidProperty(property: any): property is {
  id: string;
  coordinates: number[][];
  area?: number;
  orientation?: string;
} {
  return (
    property &&
    typeof property.id === 'string' &&
    isValidCoordinateArray(property.coordinates)
  );
}