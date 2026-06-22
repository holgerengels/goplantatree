import mongoose from 'mongoose';

/**
 * Soft-Ref Registry: Maps each model to the fields that reference it via slug.
 * Used for:
 *   1. Delete-Check: "Is this object still referenced?"
 *   2. Cascade-Update: "Update all references when a slug changes"
 */
const SOFT_REFS = {
    'Project': [
        { model: 'Offering', field: 'project' },
        { model: 'Post', field: 'project' },
        { model: 'Order', field: 'project' },
        { model: 'Media', field: 'project' },
        { model: 'User', field: 'project' },
        { model: 'Subscriber', field: 'project' },
        { model: 'MailLog', field: 'project' },
    ],
    'Tree': [
        { model: 'Offering', field: 'tree' },
    ],
    'Media': [
        { model: 'Offering', field: 'image' },
        { model: 'Post', field: 'image' },
        { model: 'Page', field: 'image' },
        { model: 'Tree', field: 'image' },
    ],
    'Addon': [
        { model: 'Offering', field: 'addons' },
    ],
};

/**
 * Find all documents that reference a given slug.
 * @param {string} modelName - The model being referenced (e.g. 'Project', 'Tree', 'Media')
 * @param {string} slug - The slug value to search for
 * @returns {{ count: number, details: Array<{ model: string, field: string, count: number }> }}
 */
export async function findReferences(modelName, slug) {
    const refs = SOFT_REFS[modelName];
    if (!refs) return { count: 0, details: [] };

    const details = [];
    let totalCount = 0;

    for (const ref of refs) {
        const RefModel = mongoose.model(ref.model);
        const count = await RefModel.countDocuments({ [ref.field]: slug });
        if (count > 0) {
            details.push({ model: ref.model, field: ref.field, count });
            totalCount += count;
        }
    }

    return { count: totalCount, details };
}

/**
 * Update all soft references when a slug changes (cascade update).
 * @param {string} modelName - The model whose slug changed (e.g. 'Project', 'Tree', 'Media')
 * @param {string} oldSlug - The old slug value
 * @param {string} newSlug - The new slug value
 * @returns {{ totalUpdated: number, details: Array<{ model: string, field: string, updated: number }> }}
 */
export async function cascadeSlugUpdate(modelName, oldSlug, newSlug) {
    const refs = SOFT_REFS[modelName];
    if (!refs) return { totalUpdated: 0, details: [] };

    const details = [];
    let totalUpdated = 0;

    for (const ref of refs) {
        const RefModel = mongoose.model(ref.model);
        const result = await RefModel.updateMany(
            { [ref.field]: oldSlug },
            { $set: { [ref.field]: newSlug } }
        );
        if (result.modifiedCount > 0) {
            details.push({ model: ref.model, field: ref.field, updated: result.modifiedCount });
            totalUpdated += result.modifiedCount;
        }
    }

    return { totalUpdated, details };
}

export { SOFT_REFS };
