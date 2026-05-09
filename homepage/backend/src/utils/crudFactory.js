import { Router } from 'express';
import { auth, requirePermission, optionalAuth } from '../middleware/auth.js';

/**
 * Creates a generic CRUD router for a Mongoose Model.
 * 
 * @param {Object} Model - Mongoose Model
 * @param {String} resourceName - Name of the resource in permissions (e.g. 'projects')
 * @param {Object} options - Configuration options
 * @param {Boolean} options.publicRead - If true, GET is public (optionalAuth)
 * @param {String} options.lookupField - Field to use for GET /:id (default: '_id', often 'slug')
 * @param {Function} options.buildFilter - Function to build filter query from req
 * @param {Object} options.sort - Default sort object
 * @param {String} options.populate - Fields to populate
 */
export const createCrudRouter = (Model, resourceName, options = {}) => {
    const router = Router();
    const { 
        publicRead = false, 
        lookupField = '_id', 
        buildFilter = (req) => ({}), 
        sort = { _id: 1 }, 
        populate = '',
        disableRoutes = []
    } = options;

    const readMiddleware = publicRead 
        ? [optionalAuth] 
        : [auth, requirePermission(resourceName, 'read')];

    const scopeQuery = (req, query = {}) => {
        if (req.permissionScope === 'own' && req.user?.project) {
            query.project = req.user.project;
            if (lookupField === '_id' && query._id) {
                if (Model.modelName === 'Project') query._id = req.user.project;
            }
        }
        return query;
    };

    // GET / — List
    if (!disableRoutes.includes('list')) {
        router.get('/', ...readMiddleware, async (req, res, next) => {
            try {
                let filter = await buildFilter(req);
                
                if (req.query.all === 'true' && req.user?.permissions?.[resourceName]?.read === 'all') {
                    filter = {};
                } else {
                    filter = scopeQuery(req, filter);
                }

                let query = Model.find(filter).sort(sort);
                if (populate) {
                    if (Array.isArray(populate)) {
                        populate.forEach(p => query = query.populate(p));
                    } else {
                        query = query.populate(populate);
                    }
                }
                
                if (req.query.limit) query = query.limit(Number(req.query.limit));

                const items = await query;
                res.json(items);
            } catch (err) {
                next(err);
            }
        });
    }

    // GET /:idOrSlug — Detail
    if (!disableRoutes.includes('detail')) {
        router.get(`/:${lookupField}`, ...readMiddleware, async (req, res, next) => {
            try {
                const paramVal = req.params[lookupField];
                let queryObj = {};
                
                if (lookupField !== '_id' && paramVal.match(/^[0-9a-fA-F]{24}$/)) {
                    queryObj = { $or: [{ [lookupField]: paramVal }, { _id: paramVal }] };
                } else {
                    queryObj = { [lookupField]: paramVal };
                }
                
                queryObj = scopeQuery(req, queryObj);

                let query = Model.findOne(queryObj);
                if (populate) {
                    if (Array.isArray(populate)) {
                        populate.forEach(p => query = query.populate(p));
                    } else {
                        query = query.populate(populate);
                    }
                }

                const item = await query;
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
                res.json(item);
            } catch (err) {
                next(err);
            }
        });
    }

    // POST / — Create
    if (!disableRoutes.includes('create')) {
        router.post('/', auth, requirePermission(resourceName, 'create'), async (req, res, next) => {
            try {
                const data = { ...req.body };
                if (req.permissionScope === 'own' && req.user?.project) {
                    data.project = req.user.project;
                }
                
                const item = new Model(data);
                await item.save();
                res.status(201).json(item);
            } catch (err) {
                err.status = 400;
                next(err);
            }
        });
    }

    // PUT /:id — Update
    if (!disableRoutes.includes('update')) {
        router.put('/:id', auth, requirePermission(resourceName, 'update'), async (req, res, next) => {
            try {
                let queryObj = { _id: req.params.id };
                queryObj = scopeQuery(req, queryObj);

                const item = await Model.findOneAndUpdate(queryObj, req.body, { new: true, runValidators: true });
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });
                res.json(item);
            } catch (err) {
                err.status = 400;
                next(err);
            }
        });
    }

    // DELETE /:id — Delete
    if (!disableRoutes.includes('delete')) {
        router.delete('/:id', auth, requirePermission(resourceName, 'delete'), async (req, res, next) => {
            try {
                let queryObj = { _id: req.params.id };
                queryObj = scopeQuery(req, queryObj);

                const item = await Model.findOneAndDelete(queryObj);
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });
                res.json({ message: 'Eintrag gelöscht' });
            } catch (err) {
                next(err);
            }
        });
    }

    return router;
};
