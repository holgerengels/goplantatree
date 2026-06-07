import { Router } from 'express';
import mongoose from 'mongoose';
import { auth, requirePermission, optionalAuth } from '../middleware/auth.js';
import { findReferences, cascadeSlugUpdate } from './refIntegrity.js';

/**
 * Creates a generic CRUD router for a Mongoose Model.
 * 
 * @param {Object} Model - Mongoose Model
 * @param {String} resourceName - Name of the resource in permissions (e.g. 'projects')
 * @param {Object} options - Configuration options
 * @param {Boolean} options.publicRead - If true, GET is public (optionalAuth)
 * @param {Boolean} options.publicCreate - If true, POST is public (no auth required)
 * @param {String} options.lookupField - Field to use for GET /:id (default: '_id', often 'slug')
 * @param {Function} options.buildFilter - Function to build filter query from req
 * @param {String} options.publishedField - Field name for published/active filtering
 * @param {Object} options.sort - Default sort object
 * @param {Boolean} options.pagination - If true, return { items, total } with skip/limit support
 * @param {Function} options.preCreate - Async hook called before saving: (item, req) => {}
 * @param {Function} options.postCreate - Async hook after saving: (item, req) => response override
 * @param {Array} options.disableRoutes - Routes to disable: ['list', 'detail', 'create', 'update', 'delete']
 * @param {String} options.refIntegrityModel - Model name for ref integrity checks (e.g. 'Project', 'Tree', 'Media')
 */
export const createCrudRouter = (Model, resourceName, options = {}) => {
    const router = Router();
    const { 
        publicRead = false,
        publicCreate = false,
        lookupField = '_id', 
        buildFilter = () => ({}), 
        publishedField = null,
        sort = { _id: 1 }, 
        pagination = false,
        preCreate,
        postCreate,
        disableRoutes = [],
        refIntegrityModel = null
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
                let filter = await buildFilter(req);
                
                // Apply query params directly as slug-based filters
                // e.g. ?project=my-project-slug filters by project slug string
                for (const [key, val] of Object.entries(req.query)) {
                    if (['limit', 'skip', 'all', 'type', 'status', 'available', 'search'].includes(key)) continue;
                    if (Model.schema.paths[key] && Model.schema.paths[key].instance === 'String') {
                        filter[key] = val;
                    }
                }

                // Apply published/active filter for non-admin users
                if (publishedField && !isFullReadUser(req)) {
                    filter[publishedField] = true;
                }

                if (req.query.all === 'true' && isFullReadUser(req)) {
                    delete filter[publishedField];
                }

                filter = scopeQuery(req, filter);

                let query = Model.find(filter).sort(sort);
                
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

                const item = await Model.findOne(queryObj);
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
                
                if (preCreate) await preCreate(data, req);
                
                const item = new Model(data);
                
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

                // Check if slug is changing and cascade update references
                if (refIntegrityModel && lookupField === 'slug' && req.body.slug) {
                    const existing = await Model.findOne(queryObj);
                    if (existing && existing.slug !== req.body.slug) {
                        const cascadeResult = await cascadeSlugUpdate(refIntegrityModel, existing.slug, req.body.slug);
                        // Store cascade info for response
                        req._cascadeResult = cascadeResult;
                    }
                }

                const item = await Model.findOneAndUpdate(queryObj, req.body, { new: true, runValidators: true });
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });
                
                const response = item.toObject();
                if (req._cascadeResult?.totalUpdated > 0) {
                    response._cascade = req._cascadeResult;
                }
                res.json(response);
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

                const item = await Model.findOne(queryObj);
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });

                // Check for existing references before deleting
                if (refIntegrityModel && req.query.force !== 'true') {
                    const slug = item.slug || item._id.toString();
                    const refs = await findReferences(refIntegrityModel, slug);
                    if (refs.count > 0) {
                        return res.status(409).json({
                            error: `Wird noch von ${refs.count} Einträgen referenziert`,
                            references: refs.details,
                            message: 'Zum Löschen ?force=true anhängen'
                        });
                    }
                }

                await Model.findOneAndDelete(queryObj);
                res.json({ message: 'Eintrag gelöscht' });
            } catch (err) {
                next(err);
            }
        });
    }

    return router;
};
