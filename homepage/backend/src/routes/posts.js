import { createCrudRouter } from '../utils/crudFactory.js';
import Post from '../models/Post.js';

export default createCrudRouter(Post, 'posts', {
    publicRead: true,
    lookupField: 'slug',
    populate: [{ path: 'project', select: 'name slug' }, 'image'],
    resolveParams: { project: { model: 'Project', lookupField: 'slug' } },
    publishedField: 'published',
    buildFilter: (req) => {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        return filter;
    },
    sort: { publishedAt: -1 }
});
