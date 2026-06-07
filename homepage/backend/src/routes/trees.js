import { createCrudRouter } from '../utils/crudFactory.js';
import Tree from '../models/Tree.js';

export default createCrudRouter(Tree, 'trees', {
    publicRead: true,
    lookupField: 'slug',
    populate: { path: 'image', select: '-data -variants' },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        return filter;
    },
    sort: { name: 1 }
});
