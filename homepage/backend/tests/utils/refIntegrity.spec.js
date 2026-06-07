import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { findReferences, cascadeSlugUpdate } from '../../src/utils/refIntegrity.js';
import Project from '../../src/models/Project.js';
import Offering from '../../src/models/Offering.js';
import Post from '../../src/models/Post.js';
import Order from '../../src/models/Order.js';
import Media from '../../src/models/Media.js';
import Tree from '../../src/models/Tree.js';
import Page from '../../src/models/Page.js';
import User from '../../src/models/User.js';
import Subscriber from '../../src/models/Subscriber.js';
import MailLog from '../../src/models/MailLog.js';

describe('refIntegrity', () => {
    beforeEach(async () => {
        // Clean all collections
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    });

    describe('findReferences()', () => {
        it('should find no references for an unused slug', async () => {
            const result = await findReferences('Project', 'non-existent');
            expect(result.count).toBe(0);
            expect(result.details).toHaveLength(0);
        });

        it('should find project references across multiple collections', async () => {
            const slug = 'test-project';

            await Offering.create({ name: 'Offering A', project: slug, slug: 'offer-a' });
            await Offering.create({ name: 'Offering B', project: slug, slug: 'offer-b' });
            await Post.create({ title: 'Post', slug: 'post-1', project: slug });
            await Order.create({
                project: slug, name: 'Max', email: 'max@test.de',
                street: 'Str 1', zip: '12345', city: 'Stadt', quantity: 1, agb: true
            });

            const result = await findReferences('Project', slug);
            expect(result.count).toBe(4); // 2 offerings + 1 post + 1 order
            expect(result.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ model: 'Offering', field: 'project', count: 2 }),
                    expect.objectContaining({ model: 'Post', field: 'project', count: 1 }),
                    expect.objectContaining({ model: 'Order', field: 'project', count: 1 }),
                ])
            );
        });

        it('should find tree references in offerings', async () => {
            await Offering.create({ name: 'Offer 1', project: 'proj', slug: 'o1', tree: 'eiche' });
            await Offering.create({ name: 'Offer 2', project: 'proj', slug: 'o2', tree: 'eiche' });
            await Offering.create({ name: 'Offer 3', project: 'proj', slug: 'o3', tree: 'buche' });

            const result = await findReferences('Tree', 'eiche');
            expect(result.count).toBe(2);
            expect(result.details[0]).toEqual({ model: 'Offering', field: 'tree', count: 2 });
        });

        it('should find media references across offerings, posts, pages, trees', async () => {
            const mediaSlug = 'hero-image';
            await Offering.create({ name: 'O', project: 'p', slug: 'o', image: mediaSlug });
            await Post.create({ title: 'P', slug: 'p', image: mediaSlug });
            await Page.create({ title: 'Page', slug: 'page', image: mediaSlug });
            await Tree.create({ name: 'T', slug: 't', image: mediaSlug });

            const result = await findReferences('Media', mediaSlug);
            expect(result.count).toBe(4);
        });

        it('should return 0 for models not in the registry', async () => {
            const result = await findReferences('UnknownModel', 'some-slug');
            expect(result.count).toBe(0);
        });
    });

    describe('cascadeSlugUpdate()', () => {
        it('should update all project references when slug changes', async () => {
            const oldSlug = 'old-project';
            const newSlug = 'new-project';

            await Offering.create({ name: 'O1', project: oldSlug, slug: 'o1' });
            await Offering.create({ name: 'O2', project: oldSlug, slug: 'o2' });
            await Post.create({ title: 'P1', slug: 'p1', project: oldSlug });
            await Order.create({
                project: oldSlug, name: 'Max', email: 'max@test.de',
                street: 'Str 1', zip: '12345', city: 'Stadt', quantity: 1, agb: true
            });

            const result = await cascadeSlugUpdate('Project', oldSlug, newSlug);
            expect(result.totalUpdated).toBe(4);

            // Verify all references updated
            const offerings = await Offering.find({ project: newSlug });
            expect(offerings).toHaveLength(2);

            const posts = await Post.find({ project: newSlug });
            expect(posts).toHaveLength(1);

            const orders = await Order.find({ project: newSlug });
            expect(orders).toHaveLength(1);

            // Old slug should have no more references
            expect(await Offering.find({ project: oldSlug })).toHaveLength(0);
        });

        it('should update tree references in offerings', async () => {
            await Offering.create({ name: 'O1', project: 'p', slug: 'o1', tree: 'old-tree' });
            await Offering.create({ name: 'O2', project: 'p', slug: 'o2', tree: 'old-tree' });
            await Offering.create({ name: 'O3', project: 'p', slug: 'o3', tree: 'other-tree' });

            const result = await cascadeSlugUpdate('Tree', 'old-tree', 'new-tree');
            expect(result.totalUpdated).toBe(2);

            expect(await Offering.find({ tree: 'new-tree' })).toHaveLength(2);
            expect(await Offering.find({ tree: 'other-tree' })).toHaveLength(1);
        });

        it('should update media references across all models', async () => {
            await Offering.create({ name: 'O', project: 'p', slug: 'o', image: 'old-img' });
            await Post.create({ title: 'P', slug: 'p', image: 'old-img' });
            await Tree.create({ name: 'T', slug: 't', image: 'old-img' });

            const result = await cascadeSlugUpdate('Media', 'old-img', 'new-img');
            expect(result.totalUpdated).toBe(3);

            expect((await Offering.findOne({ slug: 'o' })).image).toBe('new-img');
            expect((await Post.findOne({ slug: 'p' })).image).toBe('new-img');
            expect((await Tree.findOne({ slug: 't' })).image).toBe('new-img');
        });

        it('should return 0 when no documents match the old slug', async () => {
            const result = await cascadeSlugUpdate('Project', 'non-existent', 'new-slug');
            expect(result.totalUpdated).toBe(0);
            expect(result.details).toHaveLength(0);
        });
    });
});
