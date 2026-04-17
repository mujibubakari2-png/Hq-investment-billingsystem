import { describe, it, expect } from 'vitest'
import { validateData, createPackageSchema } from '../lib/validation'

describe('Validation', () => {
    it('should validate a valid package', () => {
        const validPackage = {
            name: 'Test Package',
            type: 'HOTSPOT',
            category: 'PERSONAL',
            uploadSpeed: 10,
            uploadUnit: 'Mbps',
            downloadSpeed: 20,
            downloadUnit: 'Mbps',
            price: 100,
            duration: 30,
            durationUnit: 'DAYS',
            paymentType: 'PREPAID',
        }

        const result = validateData(createPackageSchema, validPackage)
        expect(result.success).toBe(true)
    })

    it('should reject invalid package', () => {
        const invalidPackage = {
            name: '',
            type: 'INVALID',
            price: -10,
        }

        const result = validateData(createPackageSchema, invalidPackage)
        expect(result.success).toBe(false)
        expect(result.errors).toContain('Package name is required')
    })
})