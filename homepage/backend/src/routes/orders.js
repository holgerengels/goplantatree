import { createCrudRouter } from '../utils/crudFactory.js';
import Order from '../models/Order.js';
import Offering from '../models/Offering.js';

export default createCrudRouter(Order, 'orders', {
    publicCreate: true,
    pagination: true,
    sort: { orderedAt: -1 },
    buildFilter: (req) => {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.project) filter.project = req.query.project;
        return filter;
    },
    preCreate: async (data) => {
        // Denormalize offering data into the order as a snapshot
        if (data.offering && typeof data.offering === 'string') {
            const offeringSlug = data.offering;
            const offering = await Offering.findOne({ slug: offeringSlug, project: data.project });
            if (offering) {
                data.offering = {
                    slug: offering.slug,
                    name: offering.name,
                    category: offering.category || '',
                    bezeichnungBotanisch: offering.bezeichnungBotanisch || '',
                    priceNet: offering.priceNet
                };
            } else {
                data.offering = { slug: offeringSlug, name: offeringSlug };
            }
        }
    },
    postCreate: (item) => ({
        orderNumber: item.orderNumber,
        message: 'Bestellung erfolgreich aufgegeben'
    })
});
