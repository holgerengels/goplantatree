import { createCrudRouter } from '../utils/crudFactory.js';
import Post from '../models/Post.js';
import Project from '../models/Project.js';

export default createCrudRouter(Post, 'posts', {
    publicRead: true,
    lookupField: 'slug',
    populate: [{ path: 'project', select: 'name slug' }, 'image'],
    buildFilter: async (req) => {
        const filter = {};
        if (req.user?.permissions?.posts?.read === 'own' && req.user.project) {
            filter.project = req.user.project;
        } else if (req.query.project) {
            const project = await Project.findOne({ slug: req.query.project });
            if (project) filter.project = project._id;
        }
        if (req.query.type) filter.type = req.query.type;
        
        // Non-admin users only see published posts
        if (!req.user || req.user.permissions?.posts?.read !== 'all') {
            filter.published = true;
        }
        return filter;
    },
    sort: { publishedAt: -1 }
});
