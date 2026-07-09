import { createCrudRouter } from '../utils/crudFactory.js';
import PermissionProfile from '../models/PermissionProfile.js';

export default createCrudRouter(PermissionProfile, 'profiles', {
    lookupField: 'slug',
    sort: { name: 1 }
});
