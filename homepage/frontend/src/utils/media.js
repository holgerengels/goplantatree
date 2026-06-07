export function buildCaption(media) {
    if (!media) return '';

    let parts = [];

    // Title
    if (media.title) {
        parts.push(`<span class="media-caption-title">${media.title}</span>`);
    }

    // Author
    if (media.author) {
        let authorStr = media.authorLink 
            ? `<a href="${media.authorLink}" target="_blank" rel="noopener noreferrer">${media.author}</a>`
            : media.author;
        parts.push(`© ${authorStr}`);
    }

    // Source
    if (media.sourceLink) {
        parts.push(`(<a href="${media.sourceLink}" target="_blank" rel="noopener noreferrer">Quelle</a>)`);
    }

    // Combine Title, Author, Source
    let leftSide = parts.join(' ');

    // License
    let licenseStr = '';
    if (media.license) {
        licenseStr = media.licenseLink 
            ? `<a href="${media.licenseLink}" target="_blank" rel="noopener noreferrer">${media.license}</a>`
            : media.license;
    }

    // Final composition
    if (leftSide && licenseStr) {
        return `${leftSide} | ${licenseStr}`;
    } else if (leftSide) {
        return leftSide;
    } else if (licenseStr) {
        return licenseStr;
    }

    return '';
}

/**
 * Build a media file URL from a slug or ObjectId string.
 * Returns null if the value is falsy.
 */
export function mediaUrl(slugOrId) {
    if (!slugOrId) return null;
    if (typeof slugOrId === 'object' && slugOrId.url) return slugOrId.url;
    if (typeof slugOrId !== 'string') return null;
    if (slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
        return `/api/v1/media/${slugOrId}/file`;
    }
    return `/api/v1/media/by-slug/${slugOrId}/file`;
}

