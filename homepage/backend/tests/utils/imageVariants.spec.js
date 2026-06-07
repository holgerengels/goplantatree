import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVariants, VARIANT_SIZES } from '../../src/utils/imageVariants.js';
import sharp from 'sharp';

// Mock sharp module
vi.mock('sharp', () => {
    return {
        default: vi.fn(() => {
            const sharpInstance = {
                metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
                resize: vi.fn().mockReturnThis(),
                webp: vi.fn().mockReturnThis(),
                toBuffer: vi.fn().mockResolvedValue({
                    data: Buffer.from('mock-webp-data'),
                    info: { width: 500, height: 500, size: 1024 }
                })
            };
            return sharpInstance;
        })
    };
});

describe('imageVariants utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate all variants if original is larger than all max widths', async () => {
        const dummyBuffer = Buffer.from('dummy');
        const variants = await generateVariants(dummyBuffer);

        expect(sharp).toHaveBeenCalled();
        expect(Object.keys(variants)).toEqual(['thumb', 'small', 'medium']);
        
        expect(variants.thumb.mimeType).toBe('image/webp');
        expect(variants.thumb.data).toBeDefined();
        expect(variants.thumb.width).toBe(500);
    });

    it('should skip generating variants that are larger than the original image', async () => {
        // Change mock metadata to simulate a small image
        sharp.mockImplementation(() => ({
            metadata: vi.fn().mockResolvedValue({ width: 300, height: 300 }),
            resize: vi.fn().mockReturnThis(),
            webp: vi.fn().mockReturnThis(),
            toBuffer: vi.fn().mockResolvedValue({
                data: Buffer.from('mock-webp-data'),
                info: { width: 200, height: 200, size: 512 }
            })
        }));

        const dummyBuffer = Buffer.from('dummy');
        const variants = await generateVariants(dummyBuffer);

        // Since width is 300:
        // thumb (200) -> generated
        // small (480) -> skipped
        // medium (960) -> skipped
        expect(Object.keys(variants)).toEqual(['thumb']);
        expect(variants.thumb).toBeDefined();
        expect(variants.small).toBeUndefined();
    });

    it('should return empty object if metadata has no width', async () => {
        sharp.mockImplementation(() => ({
            metadata: vi.fn().mockResolvedValue({})
        }));

        const dummyBuffer = Buffer.from('dummy');
        const variants = await generateVariants(dummyBuffer);

        expect(Object.keys(variants).length).toBe(0);
    });
});
