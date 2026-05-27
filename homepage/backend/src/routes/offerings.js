import { createCrudRouter } from '../utils/crudFactory.js';
import Offering from '../models/Offering.js';

export default createCrudRouter(Offering, 'offerings', {
    publicRead: true,
    populate: [
        { 
            path: 'tree', 
            select: 'name slug category image sizeCategory height width properties',
            populate: { path: 'image', select: 'url format' }
        },
        { path: 'project', select: 'name slug' },
        { path: 'image', select: '-data' }
    ],
    sort: { sortOrder: 1, name: 1 },
    resolveParams: { project: { model: 'Project', lookupField: 'slug' } },
    buildFilter: (req, resolved) => {
        const filter = {};
        if (req.query.available !== undefined) filter.available = req.query.available === 'true';
        return filter;
    }
});
