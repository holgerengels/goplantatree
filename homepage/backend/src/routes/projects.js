import { createCrudRouter } from '../utils/crudFactory.js';
import Project from '../models/Project.js';

export default createCrudRouter(Project, 'projects', {
    publicRead: true,
    lookupField: 'slug',
    buildFilter: () => ({ active: true }),
    sort: { name: 1 }
});
