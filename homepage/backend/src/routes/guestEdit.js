import { Router } from 'express';
import multer from 'multer';
import { extname } from 'path';
import dns from 'dns';
import sizeOf from 'image-size';
import GuestEdit from '../models/GuestEdit.js';
import Post from '../models/Post.js';
import Media from '../models/Media.js';
import MailTemplate from '../models/MailTemplate.js';
import ChangeLog from '../models/ChangeLog.js';
import { slugify } from '../utils/slugify.js';
import { generateVariants } from '../utils/imageVariants.js';
import { sendMail, resolveMailAccount, getAccountKeys } from '../utils/mailService.js';
import { renderTemplate } from '../utils/mailTemplateEngine.js';
import { computeDiff } from '../utils/crudFactory.js';

/**
 * Generic guest-edit routes (magic link, no user account required).
 *
 *   POST /api/v1/guest-edit/submit/:resource  — public submission (creates unpublished doc + GuestEdit + mail)
 *   POST /api/v1/guest-edit/:token/confirm    — load doc; on first call publish it (confirmedAt = now)
 *   PUT  /api/v1/guest-edit/:token            — update allowed fields (optional new image)
 *
 * Confirmation state lives exclusively in GuestEdit.confirmedAt — target models stay untouched.
 */
const router = Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }
});

/** Resources that support guest editing. Extend here for e.g. 'orders'. */
const RESOURCE_MODELS = {
    posts: Post
};

const VALID_POST_TYPES = ['news', 'artikel', 'pflanzung'];
// 'type' is intentionally NOT editable — it is fixed by the [[post-submit]] macro
const POST_ALLOWED_FIELDS = ['title', 'content', 'excerpt', 'author', 'image', 'project', 'published'];

/**
 * Resolve mail account: project account if specified, fallback to 'info' (or first available)
 * for global/cross-project posts.
 */
function resolveGuestMailAccount(projectSlug) {
    if (projectSlug) {
        return resolveMailAccount(projectSlug);
    }
    const accounts = getAccountKeys();
    if (accounts.includes('info')) return 'info';
    if (accounts.length > 0) return accounts[0];
    throw new Error('[GuestEdit] No mail account available in mail.json.');
}

/**
 * Determine the base URL for guest confirmation / edit links.
 * Prefers the caller's origin/referer if on localhost (dev mode) or uses SITE_URL.
 */
function resolveSiteUrl(req) {
    const origin = req?.get ? req.get('origin') : null;
    if (origin) {
        try {
            const url = new URL(origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                return origin.replace(/\/$/, '');
            }
        } catch (_) {}
    }
    const referer = req?.get ? req.get('referer') : null;
    if (referer) {
        try {
            const url = new URL(referer);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                return `${url.protocol}//${url.host}`.replace(/\/$/, '');
            }
        } catch (_) {}
    }
    return (process.env.SITE_URL || 'https://goplantatree.org').replace(/\/$/, '');
}

/**
 * Strip unsafe HTML tags/attributes from guest rich-text input.
 */
function sanitizeGuestHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<(object|embed|form|input|button|link|meta)\b[^>]*>/gi, '')
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, '');
}

/**
 * Remove macro syntax ([[...]]) so guests cannot embed CMS macros in their content.
 */
function stripMacros(html) {
    return html.replace(/\[\[[^\]]*\]\]/g, '');
}

/**
 * Build a plain-text excerpt from HTML if none was explicitly provided.
 */
function deriveExcerpt(html, maxLen = 180) {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trim() + '…';
}

/**
 * Save an uploaded image buffer into the Media collection (with variants) and return its slug.
 */
async function saveUploadedImage(file, { title = '', author = '', project = null } = {}) {
    if (!file || !file.mimetype?.startsWith('image/')) {
        const err = new Error('Bitte wähle eine gültige Bilddatei aus.');
        err.status = 400;
        throw err;
    }

    let width, height, format = 'unknown';
    try {
        const dimensions = sizeOf(file.buffer);
        width = dimensions.width;
        height = dimensions.height;
        if (width && height) {
            if (width > height) format = 'landscape';
            else if (width < height) format = 'portrait';
            else format = 'square';
        }
    } catch {
        // Ignore dimension extraction errors
    }

    const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname);
    const baseName = file.originalname.replace(/\.[^.]+$/, '');
    const baseSlug = slugify(baseName) || 'foto';
    let slug = baseSlug;
    let counter = 2;
    while (await Media.findOne({ slug })) {
        slug = `${baseSlug}-${counter++}`;
    }

    const media = new Media({
        filename,
        originalName: file.originalname,
        slug,
        mimeType: file.mimetype,
        size: file.size,
        url: 'pending',
        data: file.buffer,
        width,
        height,
        format,
        title: title || '',
        author: author || '',
        project: project || null
    });

    media.url = `/api/v1/media/${media._id}/file`;
    try {
        media.variants = await generateVariants(file.buffer);
    } catch (e) {
        console.error('[GuestEdit] Failed to generate image variants:', e.message);
    }

    await media.save();
    return media.slug;
}

/**
 * Generate a unique Post slug within a project scope.
 */
async function generateUniquePostSlug(title, project = null) {
    const baseSlug = slugify(title) || 'beitrag';
    let candidate = baseSlug;
    let counter = 2;
    while (await Post.findOne({ project: project || null, slug: candidate })) {
        candidate = `${baseSlug}-${counter++}`;
    }
    return candidate;
}

const logChange = (entry) => {
    ChangeLog.create(entry).catch(err => {
        console.error('[ChangeLog] Failed to write log entry:', err.message);
    });
};

/**
 * Load GuestEdit + target document for a token, or send an error response.
 * Returns null if a response was already sent.
 */
async function loadByToken(token, res) {
    const guestEdit = await GuestEdit.findOne({ token });
    if (!guestEdit) {
        res.status(404).json({ error: 'Ungültiger oder abgelaufener Bearbeitungslink.' });
        return null;
    }
    if (guestEdit.expiresAt && guestEdit.expiresAt < new Date()) {
        res.status(410).json({ error: 'Dieser Bearbeitungslink ist abgelaufen.' });
        return null;
    }
    const Model = RESOURCE_MODELS[guestEdit.resource];
    if (!Model) {
        res.status(400).json({ error: 'Unbekannter Ressourcentyp.' });
        return null;
    }
    const doc = await Model.findById(guestEdit.documentId);
    if (!doc) {
        res.status(404).json({ error: 'Der zugehörige Eintrag wurde nicht gefunden.' });
        return null;
    }
    return { guestEdit, doc };
}

// POST /api/v1/guest-edit/submit/:resource — Public guest submission
router.post('/submit/:resource', upload.single('file'), async (req, res, next) => {
    try {
        const { resource } = req.params;
        if (resource !== 'posts') {
            return res.status(400).json({ error: 'Ungültiger Ressourcentyp für Gast-Einreichung.' });
        }

        const email = (req.body.email || '').trim().replace(/\.$/, '');
        const author = (req.body.author || '').trim();
        const title = (req.body.title || '').trim();
        const project = req.body.project ? String(req.body.project).trim() : null;
        const requestedType = (req.body.type || 'pflanzung').trim();
        const type = VALID_POST_TYPES.includes(requestedType) ? requestedType : 'pflanzung';

        if (!author) {
            return res.status(400).json({ error: 'Bitte gib deinen Namen an.' });
        }
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' });
        }
        if (!title) {
            return res.status(400).json({ error: 'Bitte gib einen Titel an.' });
        }

        // MX record check (skipped in tests to avoid network dependency)
        if (process.env.NODE_ENV !== 'test') {
            const domain = email.split('@')[1];
            try {
                await dns.promises.resolveMx(domain);
            } catch {
                return res.status(400).json({
                    error: `Die E-Mail-Domain "${domain}" scheint ungültig zu sein. Bitte überprüfe deine E-Mail-Adresse.`
                });
            }
        }

        // Resolve mail account BEFORE saving — submission must not exist without confirmation mail
        const account = resolveGuestMailAccount(project);

        const content = stripMacros(sanitizeGuestHtml(req.body.content || ''));
        const excerpt = req.body.excerpt ? String(req.body.excerpt).trim() : deriveExcerpt(content);

        let imageSlug = null;
        if (req.file) {
            imageSlug = await saveUploadedImage(req.file, { title, author, project });
        }

        const post = new Post({
            project,
            type,
            title,
            slug: await generateUniquePostSlug(title, project),
            content,
            excerpt,
            image: imageSlug,
            author,
            publishedAt: new Date(),
            published: false
        });
        await post.save();

        const guestEdit = await GuestEdit.create({
            resource: 'posts',
            documentId: post._id,
            email,
            project,
            allowedFields: POST_ALLOWED_FIELDS
        });

        logChange({
            user: `guest:${email}`,
            resource: 'posts',
            action: 'create',
            documentId: post._id.toString(),
            documentSlug: post.slug,
            before: null,
            after: post.toObject(),
            metadata: { source: 'guest-submit', ip: req.ip }
        });

        const siteUrl = resolveSiteUrl(req);
        const confirmUrl = `${siteUrl}/bearbeiten/${guestEdit.token}`;

        let template = null;
        if (project) {
            template = await MailTemplate.findOne({ slug: 'post-confirm', project, active: true });
        }
        if (!template) {
            template = await MailTemplate.findOne({ slug: 'post-confirm', project: null, active: true });
        }

        const vars = {
            name: author,
            author,
            email,
            title: post.title,
            project: project || '',
            confirm_url: confirmUrl
        };

        const mailSubject = template
            ? renderTemplate(template.subject, vars)
            : `🌱 Bitte bestätige deinen Beitrag: ${post.title}`;

        const mailHtml = template
            ? renderTemplate(template.html, vars)
            : `
                <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #2E5641;">Beitrag bestätigen</h2>
                    <p>Hallo ${author},</p>
                    <p>vielen Dank für deinen Beitrag <strong>„${post.title}“</strong>!</p>
                    <p>Mit einem Klick auf den folgenden Link wird dein Beitrag sofort veröffentlicht. Über denselben Link kannst du ihn auch später jederzeit bearbeiten:</p>
                    <p style="margin: 24px 0;">
                        <a href="${confirmUrl}" style="background: #2E5641; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                            ✅ Beitrag veröffentlichen
                        </a>
                    </p>
                    <p style="color: #888; font-size: 12px;">Bitte bewahre diese E-Mail auf, wenn du deinen Beitrag später noch ändern möchtest. Falls du keinen Beitrag eingereicht hast, kannst du diese E-Mail einfach ignorieren.</p>
                </div>
            `;

        await sendMail(account, {
            to: email,
            subject: mailSubject,
            html: mailHtml,
            template: 'post-confirm',
            referenceId: post._id,
            referenceType: 'Post',
            projectId: project
        });

        res.status(201).json({
            message: 'Bitte prüfe dein E-Mail-Postfach und klicke auf den Bestätigungslink – damit geht dein Beitrag sofort online!'
        });
    } catch (err) {
        err.status = err.status || 400;
        next(err);
    }
});

// POST /api/v1/guest-edit/:token/confirm — Load item via token and publish on first click
router.post('/:token/confirm', async (req, res, next) => {
    try {
        const loaded = await loadByToken(req.params.token, res);
        if (!loaded) return;
        const { guestEdit, doc } = loaded;

        let justConfirmed = false;
        if (!guestEdit.confirmedAt) {
            const beforeSnap = doc.toObject();

            guestEdit.confirmedAt = new Date();
            guestEdit.lastUsedAt = new Date();
            await guestEdit.save();

            if (doc.published === false) {
                doc.published = true;
                doc.publishedAt = new Date();
                await doc.save();

                const afterSnap = doc.toObject();
                logChange({
                    user: `guest:${guestEdit.email}`,
                    resource: guestEdit.resource,
                    action: 'update',
                    documentId: doc._id.toString(),
                    documentSlug: doc.slug || null,
                    before: beforeSnap,
                    after: afterSnap,
                    diff: computeDiff(beforeSnap, afterSnap),
                    metadata: { source: 'guest-confirm', ip: req.ip }
                });
            }
            justConfirmed = true;
        }

        res.json({
            resource: guestEdit.resource,
            item: doc,
            allowedFields: guestEdit.allowedFields,
            justConfirmed
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/v1/guest-edit/:token — Update guest-owned item (optionally with new image)
router.put('/:token', upload.single('file'), async (req, res, next) => {
    try {
        const loaded = await loadByToken(req.params.token, res);
        if (!loaded) return;
        const { guestEdit, doc } = loaded;

        const beforeSnap = doc.toObject();
        const allowed = new Set(guestEdit.allowedFields || []);

        // Image: replace with new upload, or remove
        if (allowed.has('image')) {
            if (req.file) {
                doc.image = await saveUploadedImage(req.file, {
                    title: req.body.title || doc.title,
                    author: req.body.author || doc.author,
                    project: doc.project
                });
            } else if (req.body.removeImage === 'true') {
                doc.image = null;
            }
        }

        for (const [key, val] of Object.entries(req.body)) {
            if (!allowed.has(key) || key === 'image') continue;

            if (key === 'content') {
                doc.content = stripMacros(sanitizeGuestHtml(val));
                if (!req.body.excerpt && allowed.has('excerpt')) {
                    doc.excerpt = deriveExcerpt(doc.content);
                }
            } else if (key === 'published') {
                doc.published = val === true || val === 'true';
            } else if (key === 'project') {
                doc.project = val ? String(val).trim() : null;
            } else if (key === 'title' || key === 'author') {
                const trimmed = String(val).trim();
                if (!trimmed) {
                    return res.status(400).json({ error: key === 'title' ? 'Bitte gib einen Titel an.' : 'Bitte gib einen Namen an.' });
                }
                doc[key] = trimmed;
            } else {
                doc[key] = typeof val === 'string' ? val.trim() : val;
            }
        }

        await doc.save();

        guestEdit.lastUsedAt = new Date();
        if (!guestEdit.confirmedAt) guestEdit.confirmedAt = new Date();
        await guestEdit.save();

        const afterSnap = doc.toObject();
        logChange({
            user: `guest:${guestEdit.email}`,
            resource: guestEdit.resource,
            action: 'update',
            documentId: doc._id.toString(),
            documentSlug: doc.slug || null,
            before: beforeSnap,
            after: afterSnap,
            diff: computeDiff(beforeSnap, afterSnap),
            metadata: { source: 'guest-edit', ip: req.ip }
        });

        res.json({ message: 'Änderungen gespeichert.', item: doc });
    } catch (err) {
        if (err.code === 11000) {
            err.status = 409;
            err.message = 'Ein Beitrag mit diesem Titel existiert in diesem Projekt bereits.';
        }
        err.status = err.status || 400;
        next(err);
    }
});

// Multer error handler (must be registered after the routes) — readable error for file size limit
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: `Die Datei ist zu groß. Maximale Dateigröße: ${MAX_FILE_SIZE / (1024 * 1024)} MB`
        });
    }
    next(err);
});

export default router;
