import { createCrudRouter } from '../utils/crudFactory.js';
import Offering from '../models/Offering.js';

export default createCrudRouter(Offering, 'offerings', {
    publicRead: true,
    lookupField: 'slug',
    sort: { sortOrder: 1, name: 1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.available !== undefined) filter.available = req.query.available === 'true';
        if (req.query.project) filter.project = req.query.project;
        return filter;
    }
});
