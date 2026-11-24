import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVariants, VARIANT_SIZES } from '../../src/utils/imageVariants.js';
import sharp from 'sharp';

// Mock sharp module
const mockRotate = vi.fn().mockReturnThis();
const mockResize = vi.fn().mockReturnThis();
const mockWebp = vi.fn().mockReturnThis();
const mockToBuffer = vi.fn().mockResolvedValue({
    data: Buffer.from('mock-webp-data'),
    info: { width: 500, height: 500, size: 1024 }
});

vi.mock('sharp', () => {
    return {
        default: vi.fn(() => {
            const sharpInstance = {
                metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
                rotate: mockRotate,
                resize: mockResize,
                webp: mockWebp,
                toBuffer: mockToBuffer
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
        expect(mockRotate).toHaveBeenCalled();
        expect(Object.keys(variants)).toEqual(['thumb', 'small', 'medium']);
        
        expect(variants.thumb.mimeType).toBe('image/webp');
        expect(variants.thumb.data).toBeDefined();
        expect(variants.thumb.width).toBe(500);
    });

    it('should skip generating variants that are larger than the original image', async () => {
        // Change mock metadata to simulate a small image
        sharp.mockImplementation(() => ({
            metadata: vi.fn().mockResolvedValue({ width: 300, height: 300 }),
            rotate: mockRotate,
            resize: mockResize,
            webp: mockWebp,
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

    it('should consider EXIF orientation when calculating effective dimensions', async () => {
        // Image with raw width: 600, height: 400, but orientation: 6 (rotated 90 deg)
        // Effective upright dimensions: width: 400, height: 600
        sharp.mockImplementation(() => ({
            metadata: vi.fn().mockResolvedValue({ width: 600, height: 400, orientation: 6 }),
            rotate: mockRotate,
            resize: mockResize,
            webp: mockWebp,
            toBuffer: vi.fn().mockResolvedValue({
                data: Buffer.from('mock-webp-data'),
                info: { width: 200, height: 300, size: 512 }
            })
        }));

        const dummyBuffer = Buffer.from('dummy');
        const variants = await generateVariants(dummyBuffer);

        // Effective width is 400:
        // thumb (200) -> generated (400 > 200)
        // small (480) -> skipped (400 <= 480)
        // medium (960) -> skipped (400 <= 960)
        expect(Object.keys(variants)).toEqual(['thumb']);
        expect(mockRotate).toHaveBeenCalled();
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
