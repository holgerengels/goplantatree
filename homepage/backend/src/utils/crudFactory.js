import { Router } from 'express';
import mongoose from 'mongoose';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import multer from 'multer';
import { auth, requirePermission, optionalAuth } from '../middleware/auth.js';
import { findReferences, cascadeSlugUpdate } from './refIntegrity.js';
import ChangeLog from '../models/ChangeLog.js';

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

/** Fields to strip from changelog snapshots (sensitive or binary) */
const SANITIZE_KEYS = ['passwordHash', 'data', '__v'];

/**
 * Remove sensitive / binary fields from a document snapshot for logging.
 */
const sanitizeForLog = (doc) => {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    for (const key of SANITIZE_KEYS) {
        delete obj[key];
    }
    // Strip binary variant data from Media documents
    if (obj.variants && typeof obj.variants === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(obj.variants)) {
            if (v && typeof v === 'object') {
                const { data: _data, ...rest } = v;
                cleaned[k] = rest;
            } else {
                cleaned[k] = v;
            }
        }
        obj.variants = cleaned;
    }
    return obj;
};

/**
 * Compute a shallow diff between two plain objects.
 * Returns { field: { from, to } } for changed top-level keys.
 */
export const computeDiff = (before, after) => {
    if (!before || !after) return null;
    const diff = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
        if (SANITIZE_KEYS.includes(key)) continue;
        if (key === '_id' || key === '__v') continue;
        const bVal = JSON.stringify(before[key] ?? null);
        const aVal = JSON.stringify(after[key] ?? null);
        if (bVal !== aVal) {
            diff[key] = { from: before[key] ?? null, to: after[key] ?? null };
        }
    }
    return Object.keys(diff).length ? diff : null;
};

/**
 * Fire-and-forget changelog entry creation.
 */
const logChange = (entry) => {
    ChangeLog.create(entry).catch(err => {
        console.error('[ChangeLog] Failed to write log entry:', err.message);
    });
};

const isBlank = (v) => v === undefined || v === null || v === '';

/**
 * Apply declarative per-field merge strategies (config: admin.onDuplicate.fields)
 * from imported row data onto an existing document. Mutates `target`.
 *
 * Strategies:
 *   union      — add new array values not yet present
 *   setIfEmpty — set only if the existing value is empty (alias: fill)
 *   overwrite  — replace with non-empty new value (alias: replace)
 *   merge      — shallow-merge object keys (e.g. data.*)
 *
 * @returns {Boolean} true if anything changed
 */
export const applyMergeStrategies = (target, data, fieldStrategies = {}) => {
    let modified = false;
    const markModified = (key) => {
        if (typeof target.markModified === 'function') target.markModified(key);
    };

    for (const [fieldKey, strategy] of Object.entries(fieldStrategies)) {
        const newVal = data[fieldKey];
        if (newVal === undefined) continue;

        if (strategy === 'union') {
            const curArr = Array.isArray(target[fieldKey]) ? target[fieldKey] : [];
            const toAdd = Array.isArray(newVal) ? newVal : [newVal];
            for (const item of toAdd) {
                if (!isBlank(item) && !curArr.includes(item)) {
                    curArr.push(item);
                    modified = true;
                }
            }
            target[fieldKey] = curArr;
            markModified(fieldKey);
        } else if (strategy === 'setIfEmpty' || strategy === 'fill') {
            const cur = target[fieldKey];
            const isEmpty = isBlank(cur) || (Array.isArray(cur) && cur.length === 0);
            if (isEmpty && !isBlank(newVal)) {
                target[fieldKey] = newVal;
                modified = true;
            }
        } else if (strategy === 'overwrite' || strategy === 'replace') {
            if (!isBlank(newVal) && JSON.stringify(target[fieldKey]) !== JSON.stringify(newVal)) {
                target[fieldKey] = newVal;
                modified = true;
            }
        } else if (strategy === 'merge') {
            if (typeof newVal === 'object' && newVal !== null) {
                if (!target[fieldKey] || typeof target[fieldKey] !== 'object') {
                    target[fieldKey] = {};
                }
                for (const [subK, subV] of Object.entries(newVal)) {
                    if (JSON.stringify(target[fieldKey][subK]) !== JSON.stringify(subV)) {
                        target[fieldKey][subK] = subV;
                        modified = true;
                    }
                }
                markModified(fieldKey);
            }
        }
    }
    return modified;
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
        publicFields = null,
        lookupField = '_id', 
        buildFilter = () => ({}), 
        publishedField = null,
        sort = { _id: 1 }, 
        preCreate,
        postCreate,
        onImportDuplicate = null,
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
                    if (['limit', 'skip', 'paged', 'count', 'sort', 'sortDir', 'all', 'type', 'status', 'available', 'search'].includes(key)) continue;
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
                    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const searchRegex = new RegExp(escaped, 'i');
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

                // Count-only mode: return just the total without loading documents
                if (req.query.count === 'true') {
                    const total = await Model.countDocuments(filter);
                    return res.json({ total });
                }

                let query = Model.find(filter).sort(effectiveSort).collation({ locale: 'de', numericOrdering: true });
                
                // Response format is chosen by the caller, not the entity:
                //   ?paged=true → { items, total }  (admin editor, default page size 100)
                //   otherwise   → plain array        (public pages, stores, selectors)
                const paged = req.query.paged === 'true';
                const limit = parseInt(req.query.limit) || (paged ? 100 : 0);
                const skip = parseInt(req.query.skip) || 0;

                if (skip) query = query.skip(skip);
                if (limit) query = query.limit(limit);

                const items = await query;

                if (paged) {
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
                        row[col.key] = formatExportValue(val, col.type);
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
                const header = columns.map(c => escapeCSV(c.key)).join(';');
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
            const uniqueFieldNames = cfg.admin?.unique || cfg.unique || fields.filter(f => f.unique).map(f => f.name);
            const supportsDataPayload = fields.some(f => f.name === 'data') || !!Model.schema.paths['data'];

            // Duplicate merge strategy from config (e.g. { strategy: 'merge', fields: { topics: 'union', data: 'merge' } })
            const onDuplicateConfig = cfg.admin?.onDuplicate || cfg.onDuplicate;
            let duplicateStrategy = 'skip';
            let fieldStrategies = {};
            if (typeof onDuplicateConfig === 'string') {
                duplicateStrategy = onDuplicateConfig;
            } else if (onDuplicateConfig && typeof onDuplicateConfig === 'object') {
                if (onDuplicateConfig.strategy) {
                    duplicateStrategy = onDuplicateConfig.strategy;
                    fieldStrategies = onDuplicateConfig.fields || {};
                } else {
                    duplicateStrategy = 'merge';
                    fieldStrategies = onDuplicateConfig;
                }
            }

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

            // Parse row data helper
            const parseRowData = (row) => {
                const data = {};

                // Map row keys to model fields
                for (const [key, val] of Object.entries(row)) {
                    const trimmedKey = key.trim();
                    const cleanKey = trimmedKey.toLowerCase();

                    // Check for payload fields starting with 'data.' (only if entity supports data payload)
                    if (cleanKey.startsWith('data.')) {
                        if (supportsDataPayload) {
                            const subKey = trimmedKey.slice(5).trim();
                            if (subKey) {
                                if (!data.data || typeof data.data !== 'object') {
                                    data.data = {};
                                }
                                let cleanVal = typeof val === 'string' ? val.trim() : val;
                                if (typeof cleanVal === 'string' && (cleanVal.startsWith('{') || cleanVal.startsWith('['))) {
                                    try { cleanVal = JSON.parse(cleanVal); } catch {}
                                }
                                data.data[subKey] = cleanVal;
                            }
                        }
                        continue;
                    }

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
                                const parsed = typeof cleanVal === 'object' ? cleanVal : JSON.parse(cleanVal);
                                if (data[mappedKey] && typeof data[mappedKey] === 'object') {
                                    data[mappedKey] = { ...data[mappedKey], ...parsed };
                                } else {
                                    data[mappedKey] = parsed;
                                }
                            } catch {
                                data[mappedKey] = cleanVal;
                            }
                        } else if (cleanVal !== '') {
                            data[mappedKey] = cleanVal;
                        }
                    }
                }

                // Apply defaults from field definitions if not specified
                for (const field of fields) {
                    if (field.default !== undefined) {
                        if (data[field.name] === undefined || data[field.name] === '' || (Array.isArray(data[field.name]) && data[field.name].length === 0)) {
                            data[field.name] = Array.isArray(field.default) ? [...field.default] : field.default;
                        }
                    }
                }

                // Set project from query param if not set in row
                if (!data.project && req.query.project) {
                    data.project = req.query.project;
                }

                // Enforce permission scope 'own'
                if (req.permissionScope === 'own' && req.user?.project) {
                    data.project = req.user.project;
                }

                return data;
            };

            // Preview mode: return first 3 rows parsed without saving to DB
            if (req.query.preview === 'true') {
                const previewRows = rawData.slice(0, 3).map((row, idx) => ({
                    rowNum: idx + 2,
                    data: parseRowData(row)
                }));
                return res.json({
                    preview: previewRows,
                    totalRows: rawData.length,
                    headers: Object.keys(rawData[0] || {})
                });
            }

            const stats = { imported: 0, updated: 0, skipped: 0, skippedItems: [], updatedItems: [], errors: [] };

            for (const [index, row] of rawData.entries()) {
                const rowNum = index + 2; // Row 1 is header
                let data = {};
                try {
                    data = parseRowData(row);

                    // Run preCreate hook if present
                    if (preCreate) {
                        await preCreate(data, req);
                    }

                    const item = new Model(data);
                    await item.save();
                    stats.imported++;

                    // Changelog: log import create
                    logChange({
                        user: req.user?.username || 'system',
                        resource: resourceName,
                        action: 'create',
                        documentId: item._id.toString(),
                        documentSlug: item.slug || null,
                        before: null,
                        after: sanitizeForLog(item),
                        metadata: { source: 'import', filename: req.file?.originalname || null }
                    });
                } catch (err) {
                    if (err.code === 11000) {
                        const uniqueDesc = Array.isArray(uniqueFieldNames) && uniqueFieldNames.length ? uniqueFieldNames.join(', ') : 'Eintrag';
                        const identifierValues = Array.isArray(uniqueFieldNames)
                            ? uniqueFieldNames.map(k => data[k] || row[k]).filter(Boolean)
                            : [];
                        const identifier = identifierValues.join(', ') || data.name || data.title || data.email || row['name'] || row['email'] || '';

                        let handled = false;
                        let updateSuccess = false;

                        if (onImportDuplicate || duplicateStrategy === 'merge') {
                            try {
                                let lookupQuery = err.keyValue ? { ...err.keyValue } : null;
                                if (!lookupQuery || Object.keys(lookupQuery).length === 0) {
                                    lookupQuery = {};
                                    for (const key of uniqueFieldNames) {
                                        if (data[key] !== undefined) lookupQuery[key] = data[key];
                                    }
                                    if (Model.schema.paths['project'] && data.project !== undefined) {
                                        lookupQuery.project = data.project;
                                    }
                                }

                                if (lookupQuery && Object.keys(lookupQuery).length > 0) {
                                    const existingDoc = await Model.findOne(lookupQuery);
                                    if (existingDoc) {
                                        // 1. Pluggable custom hook if provided
                                        if (onImportDuplicate) {
                                            const hookRes = await onImportDuplicate({
                                                existing: existingDoc,
                                                data,
                                                req,
                                                row,
                                                rowNum,
                                                Model
                                            });
                                            if (hookRes?.action === 'updated') {
                                                handled = true;
                                                updateSuccess = true;
                                            } else if (hookRes?.action === 'skipped') {
                                                handled = true;
                                                updateSuccess = false;
                                            }
                                        }

                                        // 2. Declarative merge strategies from config
                                        if (!handled && duplicateStrategy === 'merge') {
                                            const beforeSnapshot = typeof existingDoc.toObject === 'function' ? existingDoc.toObject() : { ...existingDoc };
                                            const modified = applyMergeStrategies(existingDoc, data, fieldStrategies);

                                            if (modified) {
                                                await existingDoc.save();
                                                handled = true;
                                                updateSuccess = true;

                                                logChange({
                                                    user: req.user?.username || 'system',
                                                    resource: resourceName,
                                                    action: 'update',
                                                    documentId: existingDoc._id.toString(),
                                                    documentSlug: existingDoc.slug || null,
                                                    before: sanitizeForLog(beforeSnapshot),
                                                    after: sanitizeForLog(existingDoc),
                                                    metadata: { source: 'import', filename: req.file?.originalname || null }
                                                });
                                            } else {
                                                handled = true;
                                                updateSuccess = false;
                                            }
                                        }
                                    }
                                }
                            } catch (mergeErr) {
                                stats.errors.push({
                                    row: rowNum,
                                    error: `Fehler beim Zusammenführen von Duplikat: ${mergeErr.message}`
                                });
                                continue;
                            }
                        }

                        if (updateSuccess) {
                            stats.updated++;
                            stats.updatedItems.push({
                                row: rowNum,
                                identifier,
                                name: data.name || row['Name'] || row['name'] || '',
                                email: data.email || row['E-Mail'] || row['email'] || row['e-mail'] || ''
                            });
                        } else {
                            stats.skipped++;
                            stats.skippedItems.push({
                                row: rowNum,
                                identifier,
                                name: data.name || row['Name'] || row['name'] || '',
                                email: data.email || row['E-Mail'] || row['email'] || row['e-mail'] || '',
                                reason: `${uniqueDesc} existiert bereits in diesem Projekt`
                            });
                        }
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

                // Optional scope via query params (e.g. ?project=slug) for slugs
                // that are only unique within a parent (offerings per project)
                for (const [key, val] of Object.entries(req.query)) {
                    if (key === lookupField || typeof val !== 'string') continue;
                    if (Model.schema.paths[key]?.instance === 'String') {
                        queryObj[key] = val;
                    }
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
                let data = { ...req.body };

                // Security: restrict fields on public endpoints to prevent arbitrary data injection
                if (publicCreate && publicFields) {
                    data = Object.fromEntries(
                        Object.entries(data).filter(([k]) => publicFields.includes(k))
                    );
                }
                if (!publicCreate && req.permissionScope === 'own' && req.user?.project) {
                    data.project = req.user.project;
                }
                
                if (preCreate) await preCreate(data, req);
                
                const item = new Model(data);
                
                await item.save();

                // Changelog: log create
                const afterSnap = sanitizeForLog(item);
                const meta = publicCreate ? { source: 'public', ip: req.ip } : null;
                logChange({
                    user: req.user?.username || 'public',
                    resource: resourceName,
                    action: 'create',
                    documentId: item._id.toString(),
                    documentSlug: item.slug || null,
                    before: null,
                    after: afterSnap,
                    metadata: meta
                });

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

                // Load old state BEFORE update for changelog
                const oldDoc = await Model.findOne(queryObj);
                if (!oldDoc) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });
                const beforeSnap = sanitizeForLog(oldDoc);

                // Check if slug is changing and cascade update references
                let cascadeResult = null;
                if (refIntegrityModel && lookupField === 'slug' && req.body.slug) {
                    if (oldDoc.slug !== req.body.slug) {
                        cascadeResult = await cascadeSlugUpdate(refIntegrityModel, oldDoc.slug, req.body.slug);
                    }
                }

                const item = await Model.findOneAndUpdate(queryObj, req.body, { new: true, runValidators: true });
                if (!item) return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });

                // Changelog: log update
                const afterSnap = sanitizeForLog(item);
                const diff = computeDiff(beforeSnap, afterSnap);
                const meta = cascadeResult?.totalUpdated > 0 ? { cascade: cascadeResult } : null;
                logChange({
                    user: req.user?.username || 'system',
                    resource: resourceName,
                    action: 'update',
                    documentId: item._id.toString(),
                    documentSlug: item.slug || null,
                    before: beforeSnap,
                    after: afterSnap,
                    diff,
                    metadata: meta
                });
                
                const response = item.toObject();
                if (cascadeResult?.totalUpdated > 0) {
                    response._cascade = cascadeResult;
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

                // Load items BEFORE delete for changelog
                const itemsToDelete = await Model.find(queryObj);

                // Check for existing references before deleting
                if (refIntegrityModel && req.query.force !== 'true') {
                    const referencedItems = [];
                    for (const item of itemsToDelete) {
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

                // Changelog: log each deleted item individually
                for (const item of itemsToDelete) {
                    logChange({
                        user: req.user?.username || 'system',
                        resource: resourceName,
                        action: 'delete',
                        documentId: item._id.toString(),
                        documentSlug: item.slug || null,
                        before: sanitizeForLog(item),
                        after: null,
                        metadata: { source: 'bulk' }
                    });
                }

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

                // Changelog: log delete
                logChange({
                    user: req.user?.username || 'system',
                    resource: resourceName,
                    action: 'delete',
                    documentId: item._id.toString(),
                    documentSlug: item.slug || null,
                    before: sanitizeForLog(item),
                    after: null
                });

                res.json({ message: 'Eintrag gelöscht' });
            } catch (err) {
                next(err);
            }
        });
    }

    return router;
};
