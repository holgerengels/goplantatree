import { Router } from 'express';
import mongoose from 'mongoose';
import { auth, requirePermission, optionalAuth } from '../middleware/auth.js';

/**
 * Resolves query parameters to ObjectIds using the resolveParams config.
 * e.g. resolveParams: { project: { model: 'Project', lookupField: 'slug' } }
 * will resolve ?project=my-slug to the ObjectId of the matching Project.
 */
const resolveQueryParams = async (req, resolveParams) => {
    const resolved = {};
    for (const [param, config] of Object.entries(resolveParams)) {
        const val = req.query[param];
        if (!val) continue;
        
        // If it's already an ObjectId, use it directly
        if (val.match?.(/^[0-9a-fA-F]{24}$/)) {
            resolved[param] = val;
        } else {
            const RefModel = mongoose.model(config.model);
            const doc = await RefModel.findOne({ [config.lookupField]: val });
            if (doc) resolved[param] = doc._id;
        }
    }
    return resolved;
};

/**
 * Apply populate to a query, handling arrays and single values.
 */
const applyPopulate = (query, populate) => {
    if (!populate) return query;
    if (Array.isArray(populate)) {
        populate.forEach(p => query = query.populate(p));
    } else {
        query = query.populate(populate);
    }
    return query;
};

/**
 * Creates a generic CRUD router for a Mongoose Model.
 * 
 * @param {Object} Model - Mongoose Model
 * @param {String} resourceName - Name of the resource in permissions (e.g. 'projects')
 * @param {Object} options - Configuration options
 * @param {Boolean} options.publicRead - If true, GET is public (optionalAuth)
 * @param {Boolean} options.publicCreate - If true, POST is public (no auth required)
 * @param {String} options.lookupField - Field to use for GET /:id (default: '_id', often 'slug')
 * @param {Function} options.buildFilter - Function to build filter query from req (after resolveParams)
 * @param {Object} options.resolveParams - Map of query params to resolve: { project: { model: 'Project', lookupField: 'slug' } }
 * @param {String} options.publishedField - Field name for published/active filtering (e.g. 'published', 'active').
 *   When set, public list requests automatically filter by {field: true}. Admin users with read:'all'
 *   permission or ?all=true bypass this filter.
 * @param {Object} options.sort - Default sort object
 * @param {String|Array} options.populate - Fields to populate
 * @param {Boolean} options.pagination - If true, return { items, total } with skip/limit support
 * @param {Function} options.preCreate - Async hook called before saving a new item: (item, req) => {}
 * @param {Function} options.postCreate - Async hook called after saving a new item: (item, req) => response override
 * @param {Array} options.disableRoutes - Routes to disable: ['list', 'detail', 'create', 'update', 'delete']
 */
export const createCrudRouter = (Model, resourceName, options = {}) => {
    const router = Router();
    const { 
        publicRead = false,
        publicCreate = false,
        lookupField = '_id', 
        buildFilter = () => ({}), 
        resolveParams = {},
        publishedField = null,
        sort = { _id: 1 }, 
        populate = '',
        pagination = false,
        preCreate,
        postCreate,
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

    /**
     * Determines if the current user can bypass the published filter.
     */
    const isFullReadUser = (req) => {
        return req.user?.permissions?.[resourceName]?.read === 'all';
    };

    // GET /distinct/:field — Distinct values for a field (for autocomplete)
    if (!disableRoutes.includes('distinct')) {
        router.get('/distinct/:field', ...readMiddleware, async (req, res, next) => {
            try {
                const field = req.params.field;
                // Sanitize: only allow simple field names (no dots, no $)
                if (!/^[a-zA-Z_]+$/.test(field)) {
                    return res.status(400).json({ error: 'Ungültiger Feldname' });
                }
                const values = await Model.distinct(field);
                // Filter out null/empty, sort alphabetically
                const cleaned = values
                    .filter(v => v != null && v !== '')
                    .sort((a, b) => String(a).localeCompare(String(b)));
                res.json(cleaned);
            } catch (err) {
                next(err);
            }
        });
    }

    // GET / — List
    if (!disableRoutes.includes('list')) {
        router.get('/', ...readMiddleware, async (req, res, next) => {
            try {
                // Resolve slug-based query params to ObjectIds
                const resolvedIds = await resolveQueryParams(req, resolveParams);

                let filter = await buildFilter(req, resolvedIds);
                
                // Merge resolved IDs into filter
                Object.assign(filter, resolvedIds);

                // Apply published/active filter for non-admin users
                if (publishedField && !isFullReadUser(req)) {
                    filter[publishedField] = true;
                }

                if (req.query.all === 'true' && isFullReadUser(req)) {
                    // Admin override: remove the published filter to see all items
                    delete filter[publishedField];
                }

                filter = scopeQuery(req, filter);

                let query = Model.find(filter).sort(sort);
                query = applyPopulate(query, populate);
                
                const limit = parseInt(req.query.limit) || (pagination ? 100 : 0);
                const skip = parseInt(req.query.skip) || 0;

                if (skip) query = query.skip(skip);
                if (limit) query = query.limit(limit);

                const items = await query;

                if (pagination) {
                    const total = await Model.countDocuments(filter);
                    res.json({ items, total });
                } else {
                    res.json(items);
                }
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
                query = applyPopulate(query, populate);

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
        const createMiddleware = publicCreate
            ? []
            : [auth, requirePermission(resourceName, 'create')];

        router.post('/', ...createMiddleware, async (req, res, next) => {
            try {
                const data = { ...req.body };
                if (!publicCreate && req.permissionScope === 'own' && req.user?.project) {
                    data.project = req.user.project;
                }
                
                const item = new Model(data);
                
                if (preCreate) await preCreate(item, req);
                
                await item.save();

                if (postCreate) {
                    const response = await postCreate(item, req);
                    if (response) return res.status(201).json(response);
                }

                res.status(201).json(item);
            } catch (err) {
                if (err.name === 'ValidationError') {
                    const messages = Object.values(err.errors).map(val => val.message);
                    return res.status(400).json({ error: messages.join(', ') });
                }
                if (err.code === 11000) {
                    err.status = 409;
                    err.message = 'Ein Eintrag mit diesen Daten existiert bereits.';
                }
                err.status = err.status || 400;
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

                if (req.permissionScope === 'own' && req.user?.project) {
                    req.body.project = req.user.project;
                }

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
