import { createCrudRouter } from '../utils/crudFactory.js';
import Order from '../models/Order.js';

export default createCrudRouter(Order, 'orders', {
    publicCreate: true,
    pagination: true,
    populate: [
        { path: 'offering', select: 'name category' },
        { path: 'project', select: 'name slug' }
    ],
    sort: { orderedAt: -1 },
    resolveParams: { project: { model: 'Project', lookupField: 'slug' } },
    buildFilter: (req, resolved) => {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        return filter;
    },
    postCreate: (item) => ({
        orderNumber: item.orderNumber,
        message: 'Bestellung erfolgreich aufgegeben'
    })
});
