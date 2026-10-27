const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

const errorHandler = (err, req, res, next) => {
    let status = err.statusCode || 500;
    let message = err.message;

    if (err.name === 'SequelizeUniqueConstraintError') {
        status = 409;
        message = 'That value is already in use';
    }

    if (err.name === 'MulterError') {
        status = 400;
        message =
            err.code === 'LIMIT_FILE_SIZE'
                ? 'File is too large (max 10 MB)'
                : 'Upload failed. Send one file in the "file" field.';
    }

    
    if (status === 500) {
        console.log(err);
        message = 'Something went wrong on the server';
    }

    res.status(status).json({ success: false, error: message });
};

module.exports = { notFound, errorHandler }