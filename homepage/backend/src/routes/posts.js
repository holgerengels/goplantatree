import { createCrudRouter } from '../utils/crudFactory.js';
import Post from '../models/Post.js';

export default createCrudRouter(Post, 'posts', {
    publicRead: true,
    lookupField: 'slug',
    publishedField: 'published',
    sort: { publishedAt: -1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        if (req.query.project) filter.project = req.query.project;
        return filter;
    }
});
