export const logger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
        console.log(`[API] ${req.method} ${req.originalUrl} ${color}${status}\x1b[0m - ${duration}ms`);
    });
    next();
};

export const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    const level = status >= 500 ? 'ERROR' : 'WARN';
    console.error(`\x1b[${status >= 500 ? '31' : '33'}m[${level}]\x1b[0m ${req.method} ${req.originalUrl} - ${err.message}`);
    if (status >= 500 && err.stack) console.error(err.stack);
    
    res.status(err.status || 500).json({
        error: err.message || 'Interner Serverfehler',
        ...(err.suggestion && { suggestion: err.suggestion }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
