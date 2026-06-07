import { createCrudRouter } from '../utils/crudFactory.js';
import Page from '../models/Page.js';

export default createCrudRouter(Page, 'pages', {
    publicRead: true,
    lookupField: 'slug',
    populate: { path: 'image', select: '-data -variants' },
    publishedField: 'published',
    sort: { title: 1 }
});
