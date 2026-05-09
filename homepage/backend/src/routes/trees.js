import { createCrudRouter } from '../utils/crudFactory.js';
import Tree from '../models/Tree.js';

export default createCrudRouter(Tree, 'trees', {
    publicRead: true,
    populate: 'image',
    buildFilter: (req) => {
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        return filter;
    },
    sort: { sortOrder: 1, name: 1 }
});
