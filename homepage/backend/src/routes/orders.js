import { createCrudRouter } from '../utils/crudFactory.js';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Offering from '../models/Offering.js';
import MailTemplate from '../models/MailTemplate.js';
import { sendMail, getAccountKeys } from '../utils/mailService.js';
import { renderTemplate } from '../utils/mailTemplateEngine.js';

/**
 * Pick the best mail account for a project.
 * Tries the project slug first, falls back to 'info'.
 */
function resolveMailAccount(projectSlug) {
    const accounts = getAccountKeys();
    if (projectSlug && accounts.includes(projectSlug)) return projectSlug;
    return 'info';
}

function normalizeString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

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
        // 1. Name must contain first and last name (at least two words)
        if (data.name && data.name.trim().split(/\s+/).length < 2) {
            const err = new mongoose.Error.ValidationError(null);
            err.addError('name', new mongoose.Error.ValidatorError({
                message: 'Bitte gib Vor- und Nachname an.'
            }));
            throw err;
        }

        // 2. Street must contain a house number
        if (data.street && !data.specialAddress && !/\d/.test(data.street)) {
            const err = new mongoose.Error.ValidationError(null);
            err.addError('street', new mongoose.Error.ValidatorError({
                message: 'Bitte gib auch die Hausnummer an.'
            }));
            throw err;
        }

        // 3. Structural PLZ check (German postal code must be exactly 5 digits)
        if (data.zip && !/^\d{5}$/.test(data.zip)) {
            const err = new mongoose.Error.ValidationError(null);
            err.addError('zip', new mongoose.Error.ValidatorError({
                message: 'Die Postleitzahl muss genau 5 Ziffern enthalten.'
            }));
            throw err;
        }

        // Only run address validation if required fields are present (let Mongoose validate missing fields first)
        const hasRequiredAddressFields = data.specialAddress
            ? (data.zip && data.city)
            : (data.street && data.zip && data.city);

        if (hasRequiredAddressFields) {
            // Address validation using OpenStreetMap Nominatim API
            const query = data.specialAddress
                ? `${data.zip} ${data.city}`
                : `${data.street}, ${data.zip} ${data.city}`;

            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'GoPlantATree-AddressValidator/1.0 (contact@goplantatree.org)'
                    }
                });
                
                if (response.ok) {
                    const results = await response.json();
                    if (!Array.isArray(results) || results.length === 0) {
                        const errorMsg = data.specialAddress
                            ? 'Die angegebene PLZ/Stadt konnte nicht gefunden werden. Bitte überprüfe deine Angaben.'
                            : 'Die Adresse konnte nicht gefunden werden. Bitte überprüfe die Schreibweise oder aktiviere das Kontrollkästchen für Sonderadressen.';
                        
                        const err = new mongoose.Error.ValidationError(null);
                        err.addError('street', new mongoose.Error.ValidatorError({ message: errorMsg }));
                        throw err;
                    }

                    const result = results[0];
                    const address = result.address || {};
                    const matchedRoad = address.road || address.street || address.pedestrian || address.highway || address.place;
                    const matchedPostcode = address.postcode;
                    const matchedCity = address.city || address.town || address.village || address.suburb || address.municipality || address.county;

                    // If not a specialAddress (e.g. regular address), we MUST have a resolved road/street component.
                    if (!data.specialAddress && !matchedRoad) {
                        const err = new mongoose.Error.ValidationError(null);
                        err.addError('street', new mongoose.Error.ValidatorError({
                            message: 'Die angegebene Straße konnte in diesem PLZ-Bereich nicht gefunden werden. Bitte überprüfe die Schreibweise oder aktiviere das Kontrollkästchen für Sonderadressen.'
                        }));
                        throw err;
                    }

                    // Reconstruct suggested values
                    const suggestedStreet = data.specialAddress
                        ? data.street
                        : `${matchedRoad}${address.house_number ? ' ' + address.house_number : ''}`;
                    const suggestedZip = matchedPostcode || data.zip;
                    const suggestedCity = matchedCity || data.city;

                    // Compare normalized user inputs against normalized suggestions
                    const isStreetMismatch = !data.specialAddress && (normalizeString(data.street) !== normalizeString(suggestedStreet));
                    const isZipMismatch = normalizeString(data.zip) !== normalizeString(suggestedZip);
                    const isCityMismatch = normalizeString(data.city) !== normalizeString(suggestedCity);

                    if (isStreetMismatch || isZipMismatch || isCityMismatch) {
                        const err = new Error('Die eingegebene Adresse konnte nicht genau zugeordnet werden. Bitte überprüfe den Vorschlag.');
                        err.status = 400;
                        err.suggestion = {
                            street: suggestedStreet,
                            zip: suggestedZip,
                            city: suggestedCity
                        };
                        throw err;
                    }
                } else {
                    console.error(`Nominatim API returned status ${response.status} for query: ${query}`);
                }
            } catch (err) {
                // Rethrow validation errors and custom correction errors
                if (err.name === 'ValidationError' || err.status === 400) {
                    throw err;
                }
                // For other errors (network issues, rate limits, etc.), fail open and log
                console.error('Nominatim address validation error (fail-open):', err);
            }
        }

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
    postCreate: async (item) => {
        // Send order confirmation mail (fire-and-forget)
        try {
            const projectSlug = item.project || null;

            // Load project-specific template, then global fallback
            let template = null;
            if (projectSlug) {
                template = await MailTemplate.findOne({ slug: 'order-confirm', project: projectSlug, active: true });
            }
            if (!template) {
                template = await MailTemplate.findOne({ slug: 'order-confirm', project: null, active: true });
            }

            if (template && item.email) {
                const vars = {
                    data: item.toObject ? item.toObject() : item
                };

                const account = resolveMailAccount(projectSlug);
                const renderedSubject = renderTemplate(template.subject, vars);
                const renderedHtml = renderTemplate(template.html, vars);

                sendMail(account, {
                    to: item.email,
                    subject: renderedSubject,
                    html: renderedHtml,
                    template: 'order-confirm',
                    referenceId: item._id,
                    referenceType: 'Order',
                    projectId: projectSlug
                }).catch(err => {
                    console.error('[Order] Confirmation mail failed:', err.message);
                });
            }
        } catch (err) {
            console.error('[Order] Template lookup failed:', err.message);
        }

        return {
            orderNumber: item.orderNumber,
            message: 'Bestellung erfolgreich aufgegeben'
        };
    }
});
