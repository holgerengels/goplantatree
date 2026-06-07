import sharp from 'sharp';

/**
 * Variant size definitions.
 * Each variant is resized to fit within maxWidth, preserving aspect ratio.
 * Output format is always WebP for optimal compression.
 */
export const VARIANT_SIZES = {
    thumb:  200,
    small:  480,
    medium: 960
};

/**
 * Generate image variants from an original buffer.
 * Skips variants that would be larger than the original.
 *
 * @param {Buffer} buffer - Original image buffer
 * @returns {Object} Map of variant name → { data, width, height, size, mimeType }
 */
export async function generateVariants(buffer) {
    const metadata = await sharp(buffer, { failOnError: false }).metadata();

    // Skip non-image or very small images
    if (!metadata.width) return {};

    const variants = {};

    for (const [name, maxWidth] of Object.entries(VARIANT_SIZES)) {
        // Don't upscale: skip if original is smaller than this variant
        if (metadata.width <= maxWidth) continue;

        const result = await sharp(buffer, { failOnError: false })
            .resize(maxWidth, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer({ resolveWithObject: true });

        variants[name] = {
            data: result.data,
            width: result.info.width,
            height: result.info.height,
            size: result.info.size,
            mimeType: 'image/webp'
        };
    }

    return variants;
}
