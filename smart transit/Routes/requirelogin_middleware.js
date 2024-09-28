const requirecard = (req, res, next) => {
  console.log(req.session.cardID);
  const card_id = req.session.cardID;
  if (!card_id) {
    req.session.returnTo = req.originalUrl; // Store the original URL
    req.flash('requirecard', 'Please scan your card first');
    return res.redirect('/home');
  }
  next();
};

const requireloginuser = (req, res, next) => {
  const user_id = req.session.user_id || req.session.secret;

  // Check if user is logged in and matches the required ID format and route
  if (!user_id || user_id[0] !== 'U' || user_id !== req.params.id) {
    req.session.returnTo = req.originalUrl;  // Store original URL
    req.flash('requireLOGIN', 'Please login first');
    return res.redirect('/home/login');  // Redirect to login page
  }

  next();  // Proceed to the next middleware or route handler
};

const requireloginadmin = (req, res, next) => {
  console.log(req.session.user_id);
  const user_id = req.session.user_id;
  if (!user_id || user_id[0] !== 'A') {
    req.session.returnTo = req.originalUrl; // Store the original URL
    req.flash('requireLOGIN', 'Please login first');
    return res.redirect('/home/login');
  }
  next();
};

module.exports = { requirecard, requireloginuser, requireloginadmin };
