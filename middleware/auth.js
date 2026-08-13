exports.ensureAuth = (req, res, next) => req.session.user ? next() : res.redirect('/login');
exports.ensureAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.status(403).render('error', { message: 'Admin access is required.' });
