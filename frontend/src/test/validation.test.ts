import { describe, it, expect } from 'vitest'
import { validateData, createPackageSchema } from '../../../backend/src/lib/validation'

describe('Package Validation', () => {
    it('should validate a valid package', () => {
        const validPackage = {
            name: 'Test Package',
            type: 'HOTSPOT',
            category: 'PERSONAL',
            uploadSpeed: 10,
            uploadUnit: 'Mbps',
            downloadSpeed: 20,
            downloadUnit: 'Mbps',
            price: 1000,
            duration: 30,
            durationUnit: 'DAYS',
            paymentType: 'PREPAID',
        }

        const result = validateData(createPackageSchema, validPackage)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.name).toBe('Test Package')
        }
    })

    it('should reject invalid package data', () => {
        const invalidPackage = {
            name: '', // empty name
            type: 'INVALID_TYPE',
            price: -100, // negative price
        }

        const result = validateData(createPackageSchema, invalidPackage)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0)
        }
    })
})