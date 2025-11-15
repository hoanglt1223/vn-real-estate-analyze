// Shared validation utilities

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class Validator {
  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Required validation
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${field} is required`,
          value
        });
        continue;
      }

      // Skip other validations if field is not required and empty
      if (!rules.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type-based validations
      if (typeof value === 'string') {
        // Min length
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          errors.push({
            field,
            message: `${field} must be at least ${rules.minLength} characters long`,
            value
          });
        }

        // Max length
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          errors.push({
            field,
            message: `${field} must not exceed ${rules.maxLength} characters`,
            value
          });
        }

        // Pattern
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({
            field,
            message: `${field} format is invalid`,
            value
          });
        }
      }

      if (typeof value === 'number') {
        // Min value
        if (rules.min !== undefined && value < rules.min) {
          errors.push({
            field,
            message: `${field} must be at least ${rules.min}`,
            value
          });
        }

        // Max value
        if (rules.max !== undefined && value > rules.max) {
          errors.push({
            field,
            message: `${field} must not exceed ${rules.max}`,
            value
          });
        }
      }

      // Custom validation
      if (rules.custom) {
        const customResult = rules.custom(value);
        if (customResult !== true) {
          errors.push({
            field,
            message: typeof customResult === 'string' ? customResult : `${field} is invalid`,
            value
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Common validation schemas
export const COMMON_SCHEMAS = {
  coordinates: {
    coordinates: {
      required: true,
      custom: (value: any) => {
        if (!Array.isArray(value) || value.length === 0) {
          return 'Coordinates must be a non-empty array';
        }

        // Check if all coordinate pairs are valid
        for (const pair of value) {
          if (!Array.isArray(pair) || pair.length !== 2) {
            return 'Each coordinate must be a pair [lng, lat]';
          }

          const [lng, lat] = pair;
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return 'Coordinates must be numbers';
          }

          if (lng < -180 || lng > 180) {
            return 'Longitude must be between -180 and 180';
          }

          if (lat < -90 || lat > 90) {
            return 'Latitude must be between -90 and 90';
          }
        }

        return true;
      }
    }
  },

  radius: {
    radius: {
      required: true,
      min: 100,
      max: 30000,
      custom: (value: any) => {
        if (typeof value !== 'number') {
          return 'Radius must be a number';
        }
        return true;
      }
    }
  },

  searchQuery: {
    query: {
      required: false,
      minLength: 2,
      maxLength: 100
    }
  },

  propertyAnalysis: {
    coordinates: {
      required: true,
      custom: (value: any) => {
        if (!Array.isArray(value) || value.length === 0) {
          return 'Coordinates must be a non-empty array';
        }

        for (const pair of value) {
          if (!Array.isArray(pair) || pair.length !== 2) {
            return 'Each coordinate must be a pair [lng, lat]';
          }

          const [lng, lat] = pair;
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return 'Coordinates must be numbers';
          }

          if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            return 'Invalid coordinate range';
          }
        }

        return null;
      }
    },

    radius: {
      required: true,
      custom: (value: any) => {
        if (typeof value !== 'number' || value <= 0) {
          return 'Radius must be a positive number';
        }

        if (value > 10000) {
          return 'Radius cannot exceed 10km';
        }

        return null;
      }
    },
    categories: {
      required: true,
      custom: (value: any) => {
        if (!Array.isArray(value)) {
          return 'Categories must be an array';
        }

        const validCategories = ['education', 'healthcare', 'shopping', 'entertainment', 'transport'];
        for (const category of value) {
          if (!validCategories.includes(category)) {
            return `Invalid category: ${category}`;
          }
        }

        return true;
      }
    },
    layers: {
      required: true,
      custom: (value: any) => {
        if (!Array.isArray(value)) {
          return 'Layers must be an array';
        }

        const validLayers = ['roads', 'metro', 'bus_routes', 'metro_lines', 'industrial', 'power', 'cemetery', 'water'];
        for (const layer of value) {
          if (!validLayers.includes(layer)) {
            return `Invalid layer: ${layer}`;
          }
        }

        return true;
      }
    }
  },

  pagination: {
    limit: {
      required: false,
      min: 1,
      max: 100
    },
    offset: {
      required: false,
      min: 0
    }
  },

  sorting: {
    sortBy: {
      required: false,
      custom: (value: any) => {
        const validFields = ['date', 'score', 'price', 'area', 'name'];
        if (!validFields.includes(value)) {
          return `Invalid sort field: ${value}`;
        }
        return true;
      }
    },
    sortOrder: {
      required: false,
      custom: (value: any) => {
        if (!['asc', 'desc'].includes(value)) {
          return 'Sort order must be "asc" or "desc"';
        }
        return true;
      }
    }
  }
};

// Utility functions
export function sanitizeString(input: any): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/[<>]/g, '');
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidVietnamesePhone(phone: string): boolean {
  const phoneRegex = /(03|05|07|08|09|01[2|6|8|9])+([0-9]{8})\b/;
  return phoneRegex.test(phone);
}

export function sanitizeCoordinates(coordinates: [number, number][]): [number, number][] {
  return coordinates.map(([lng, lat]) => {
    // Bound to Vietnam's approximate bounds with some margin
    const boundedLng = Math.max(100, Math.min(115, lng));
    const boundedLat = Math.max(5, Math.min(25, lat));

    return [boundedLng, boundedLat];
  });
}

export function validatePolygon(coordinates: [number, number][]): boolean {
  if (coordinates.length < 3) {
    return false;
  }

  // Check if polygon is closed (first and last points are the same)
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  // If not closed, we can close it automatically
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }

  return true;
}

// Error formatting
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(error => `${error.field}: ${error.message}`).join(', ');
}

// Middleware helper
export function createValidationMiddleware(schema: ValidationSchema) {
  return (data: any): ValidationResult => {
    return Validator.validate(data, schema);
  };
}