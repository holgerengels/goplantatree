import { Router } from 'express';
import mongoose from 'mongoose';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import multer from 'multer';
import { auth, requirePermission, optionalAuth } from '../middleware/auth.js';
import { findReferences, cascadeSlugUpdate } from './refIntegrity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = process.env.CONFIG_DIR || join(__dirname, '..', '..', '..', 'config');

const getConfigForResource = (resName) => {
    try {
        const files = readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = JSON.parse(readFileSync(join(CONFIG_DIR, file), 'utf-8'));
            if (content.resource === resName) {
                return content;
            }
        }
    } catch (err) {
        console.error('Error reading config for export:', err);
    }
    return null;
};

const getVal = (item, key) => {
    if (!key.includes('.')) return item[key];
    return key.split('.').reduce((obj, k) => obj?.[k], item);
};

const formatDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const formatExportValue = (val, type) => {
    if (val === undefined || val === null) return '';
    if (type === 'boolean' || typeof val === 'boolean') {
        return val ? 'Ja' : 'Nein';
    }
    if (type === 'date' || val instanceof Date) {
        return formatDate(val);
    }
    if (Array.isArray(val)) {
        return val.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
    }
    if (typeof val === 'object') {
        return val.name || val.title || val.slug || JSON.stringify(val);
    }
    return String(val);
};

const escapeCSV = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
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
            if (Model.modelName === 'Project') {
                query.slug = req.user.project;
            } else {
                query.project = req.user.project;
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

                // Server-side search: build $or across all string fields
                if (req.query.search) {
                    const searchRegex = new RegExp(req.query.search, 'i');
                    const searchConditions = [];
                    for (const [path, schemaType] of Object.entries(Model.schema.paths)) {
                        if (schemaType.instance === 'String' && !path.startsWith('_')) {
                            searchConditions.push({ [path]: searchRegex });
                        }
                    }
                    if (searchConditions.length) {
                        if (filter.$or) {
                            filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
                            delete filter.$or;
                        } else {
                            filter.$or = searchConditions;
                        }
                    }
                }

                // Allow client-specified sort via ?sort=field&sortDir=asc|desc
                let effectiveSort = sort;
                if (req.query.sort) {
                    const dir = req.query.sortDir === 'desc' ? -1 : 1;
                    effectiveSort = { [req.query.sort]: dir };
                }

                let query = Model.find(filter).sort(effectiveSort).collation({ locale: 'de', numericOrdering: true });
                
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
    // GET /export — Export list to CSV or ODS
    router.get('/export', ...readMiddleware, async (req, res, next) => {
        try {
            let filter = await buildFilter(req);
            
            // Apply query params directly as slug-based filters
            for (const [key, val] of Object.entries(req.query)) {
                if (['limit', 'skip', 'all', 'type', 'status', 'available', 'search', 'format'].includes(key)) continue;
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
            let items = await query;

            // Load configuration to get columns
            const cfg = getConfigForResource(resourceName);
            const columns = cfg?.admin?.exportColumns || cfg?.admin?.columns || [];

            // If search filter is active, filter items using column keys
            if (req.query.search && columns.length) {
                const q = req.query.search.toLowerCase();
                items = items.filter(item =>
                    columns.some(col => {
                        const val = getVal(item, col.key);
                        return val && String(val).toLowerCase().includes(q);
                    })
                );
            }

            const format = req.query.format || 'csv';

            if (format === 'ods') {
                const data = items.map(item => {
                    const row = {};
                    for (const col of columns) {
                        const val = getVal(item, col.key);
                        row[col.label] = formatExportValue(val, col.type);
                    }
                    return row;
                });

                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
                
                const buffer = XLSX.write(workbook, { bookType: 'ods', type: 'buffer' });
                
                res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet');
                res.setHeader('Content-Disposition', `attachment; filename=${resourceName}_export.ods`);
                return res.send(buffer);
            } else {
                // CSV export (default)
                const header = columns.map(c => escapeCSV(c.label)).join(';');
                const rows = items.map(item => {
                    return columns.map(col => {
                        const val = getVal(item, col.key);
                        return escapeCSV(formatExportValue(val, col.type));
                    }).join(';');
                });
                const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename=${resourceName}_export.csv`);
                return res.send(csvContent);
            }
        } catch (err) {
            next(err);
        }
    });

    // POST /import — Bulk Import
    const upload = multer({ 
        storage: multer.memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
    });

    router.post('/import', auth, requirePermission(resourceName, 'create'), upload.single('file'), async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Keine Datei hochgeladen' });
            }

            // Load configuration to map headers
            const cfg = getConfigForResource(resourceName);
            if (!cfg) {
                return res.status(400).json({ error: 'Ressourcen-Konfiguration nicht gefunden' });
            }

            const columns = cfg.admin?.columns || [];
            const fields = cfg.fields || [];

            // Build a header map: lowercase(label) -> key, lowercase(key) -> key
            const headerMap = {};
            columns.forEach(col => {
                if (col.label) headerMap[col.label.toLowerCase().trim()] = col.key;
                if (col.key) headerMap[col.key.toLowerCase().trim()] = col.key;
            });
            fields.forEach(field => {
                if (field.label) headerMap[field.label.toLowerCase().trim()] = field.name;
                if (field.name) headerMap[field.name.toLowerCase().trim()] = field.name;
            });

            // Helper to parse dates including German formats
            const parseDate = (val) => {
                if (val instanceof Date) return val;
                if (typeof val === 'number') {
                    // Excel serial date to JS Date
                    return new Date((val - 25569) * 86400 * 1000);
                }
                const str = String(val).trim();
                const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
                if (match) {
                    const day = parseInt(match[1], 10);
                    const month = parseInt(match[2], 10) - 1;
                    const year = parseInt(match[3], 10);
                    const hours = match[4] ? parseInt(match[4], 10) : 0;
                    const minutes = match[5] ? parseInt(match[5], 10) : 0;
                    return new Date(year, month, day, hours, minutes);
                }
                return new Date(str);
            };

            // Parse file with xlsx
            let workbook;
            try {
                workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            } catch (xlsxErr) {
                return res.status(400).json({ error: 'Fehler beim Lesen der Datei: ' + xlsxErr.message });
            }

            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return res.status(400).json({ error: 'Die Datei enthält keine Arbeitsblätter' });
            }

            const sheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            const stats = { imported: 0, skipped: 0, errors: [] };

            for (const [index, row] of rawData.entries()) {
                const rowNum = index + 2; // Row 1 is header
                try {
                    const data = {};

                    // Map row keys to model fields
                    for (const [key, val] of Object.entries(row)) {
                        const cleanKey = key.trim().toLowerCase();
                        const mappedKey = headerMap[cleanKey];
                        if (mappedKey) {
                            let cleanVal = typeof val === 'string' ? val.trim() : val;

                            const fieldDef = fields.find(f => f.name === mappedKey) || columns.find(c => c.key === mappedKey);
                            const isBool = fieldDef?.type === 'boolean' || fieldDef?.type === 'Boolean' || Model.schema.paths[mappedKey]?.instance === 'Boolean';
                            const isDate = fieldDef?.type === 'date' || fieldDef?.type === 'Date' || Model.schema.paths[mappedKey]?.instance === 'Date';
                            const isArray = fieldDef?.type === 'Tags' || Model.schema.paths[mappedKey]?.instance === 'Array';
                            const isMixed = fieldDef?.type === 'Json' || Model.schema.paths[mappedKey]?.instance === 'Mixed';
                            
                            if (isBool && cleanVal !== '') {
                                data[mappedKey] = ['ja', 'yes', 'true', '1', 'wahr', 'y', 'j', 'x'].includes(String(cleanVal).toLowerCase());
                            } else if (isDate && cleanVal !== '') {
                                const parsedDate = parseDate(cleanVal);
                                if (!isNaN(parsedDate.getTime())) {
                                    data[mappedKey] = parsedDate;
                                } else {
                                    data[mappedKey] = cleanVal;
                                }
                            } else if (isArray && cleanVal !== '') {
                                // Split comma-separated values into array
                                if (Array.isArray(cleanVal)) {
                                    data[mappedKey] = cleanVal;
                                } else {
                                    data[mappedKey] = String(cleanVal).split(',').map(s => s.trim()).filter(Boolean);
                                }
                            } else if (isMixed && cleanVal !== '') {
                                // Parse JSON string into object
                                try {
                                    data[mappedKey] = typeof cleanVal === 'object' ? cleanVal : JSON.parse(cleanVal);
                                } catch {
                                    data[mappedKey] = cleanVal; // Keep as string if not valid JSON
                                }
                            } else if (cleanVal !== '') {
                                data[mappedKey] = cleanVal;
                            }
                        }
                    }

                    // Enforce permission scope 'own'
                    if (req.permissionScope === 'own' && req.user?.project) {
                        data.project = req.user.project;
                    }

                    // Run preCreate hook if present
                    if (preCreate) {
                        await preCreate(data, req);
                    }

                    const item = new Model(data);
                    await item.save();
                    stats.imported++;
                } catch (err) {
                    if (err.code === 11000) {
                        stats.skipped++;
                    } else {
                        stats.errors.push({
                            row: rowNum,
                            error: err.message || 'Ungültige Daten'
                        });
                    }
                }
            }

            res.json(stats);
        } catch (err) {
            next(err);
        }
    });

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

    // DELETE / — Bulk Delete
    if (!disableRoutes.includes('delete')) {
        router.delete('/', auth, requirePermission(resourceName, 'delete'), async (req, res, next) => {
            try {
                const { ids } = req.body;
                if (!Array.isArray(ids) || !ids.length) {
                    return res.status(400).json({ error: 'Keine IDs angegeben' });
                }

                let queryObj = { _id: { $in: ids } };
                if (req.permissionScope === 'own' && req.user?.project) {
                    if (Model.modelName === 'Project') {
                        if (ids.includes(req.user.project)) {
                            queryObj._id = req.user.project;
                        } else {
                            return res.status(403).json({ error: 'Keine Berechtigung' });
                        }
                    } else {
                        queryObj.project = req.user.project;
                    }
                }

                // Check for existing references before deleting
                if (refIntegrityModel && req.query.force !== 'true') {
                    const items = await Model.find(queryObj);
                    const referencedItems = [];
                    for (const item of items) {
                        const slug = item.slug || item._id.toString();
                        const refs = await findReferences(refIntegrityModel, slug);
                        if (refs.count > 0) {
                            referencedItems.push({
                                id: item._id,
                                name: item.name || item.title || slug,
                                count: refs.count
                            });
                        }
                    }
                    if (referencedItems.length > 0) {
                        return res.status(409).json({
                            error: 'Einige Einträge werden noch referenziert',
                            referencedItems,
                            message: 'Zum Löschen ?force=true anhängen'
                        });
                    }
                }

                const result = await Model.deleteMany(queryObj);
                res.json({ message: `${result.deletedCount} Einträge gelöscht` });
            } catch (err) {
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
