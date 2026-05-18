import { createCrudRouter } from '../utils/crudFactory.js';
import Page from '../models/Page.js';

export default createCrudRouter(Page, 'pages', {
    publicRead: true,
    lookupField: 'slug',
    populate: 'image',
    publishedField: 'published',
    sort: { title: 1 }
});
