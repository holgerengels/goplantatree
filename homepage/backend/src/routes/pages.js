import { createCrudRouter } from '../utils/crudFactory.js';
import Page from '../models/Page.js';

export default createCrudRouter(Page, 'pages', {
    publicRead: true,
    lookupField: 'slug',
    populate: 'image',
    buildFilter: (req) => {
        const filter = {};
        if (!req.user || req.user.permissions?.pages?.read !== 'all') {
            filter.published = true;
        }
        return filter;
    },
    sort: { title: 1 }
});
