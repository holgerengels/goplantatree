import { createCrudRouter } from '../utils/crudFactory.js';
import MailTemplate from '../models/MailTemplate.js';

export default createCrudRouter(MailTemplate, 'mail', {
    lookupField: 'slug',
    sort: { type: 1, name: 1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        if (req.query.project) filter.project = req.query.project;
        if (req.query.active !== undefined) filter.active = req.query.active === 'true';
        return filter;
    }
});
