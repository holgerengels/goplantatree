import { createCrudRouter } from '../utils/crudFactory.js';
import Addon from '../models/Addon.js';

export default createCrudRouter(Addon, 'addons', {
    publicRead: true,
    lookupField: 'slug',
    sort: { sortOrder: 1, name: 1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.project) filter.project = req.query.project;
        return filter;
    }
});
