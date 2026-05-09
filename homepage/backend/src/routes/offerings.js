import { createCrudRouter } from '../utils/crudFactory.js';
import Offering from '../models/Offering.js';
import Project from '../models/Project.js';

export default createCrudRouter(Offering, 'offerings', {
    publicRead: true,
    populate: [
        { path: 'tree', select: 'name shortName category' },
        { path: 'project', select: 'name slug' },
        'image'
    ],
    sort: { sortOrder: 1, name: 1 },
    buildFilter: async (req) => {
        const filter = {};
        if (req.query.project) {
            const project = await Project.findOne({ slug: req.query.project });
            if (project) filter.project = project._id;
        }
        if (req.query.available !== undefined) filter.available = req.query.available === 'true';
        return filter;
    }
});
