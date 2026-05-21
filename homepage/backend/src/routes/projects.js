import { createCrudRouter } from '../utils/crudFactory.js';
import Project from '../models/Project.js';

export default createCrudRouter(Project, 'projects', {
    publicRead: true,
    lookupField: 'slug',
    publishedField: 'active',
    sort: { sortOrder: 1, name: 1 },
    populate: [
        { path: 'content.sponsors.logo', model: 'Media' },
        { path: 'content.team.avatar', model: 'Media' }
    ]
});
