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
  console.log(req.session.user_id);
  const user_id = req.session.user_id;
 

  if (!user_id || user_id[0] !== 'U') {
    req.session.returnTo = req.originalUrl; // Store the original URL
    req.flash('requireLOGIN', 'Please login first');
    return res.redirect('/home/login');
  }
  next();
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
