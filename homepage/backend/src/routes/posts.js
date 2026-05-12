import { createCrudRouter } from '../utils/crudFactory.js';
import Post from '../models/Post.js';

export default createCrudRouter(Post, 'posts', {
    publicRead: true,
    lookupField: 'slug',
    populate: [{ path: 'project', select: 'name slug' }, 'image'],
    resolveParams: { project: { model: 'Project', lookupField: 'slug' } },
    buildFilter: (req, resolved) => {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        
        // Non-admin users only see published posts
        if (!req.user || req.user.permissions?.posts?.read !== 'all') {
            filter.published = true;
        }
        return filter;
    },
    sort: { publishedAt: -1 }
});
