const express = require('express');
const router = express.Router();

//Middleware to make sure any user trying to access the user pages is logged in
router.use((req, res, next) => {
    if (req.user) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', (req, res) => { //When a user accesses /user, display a custom page with ejs
    res.render('home.ejs', {
        name: req.user.displayName,
        profileImg: req.user.profileURL
    });
});
router.get('/logout', (req, res) => { //When a user accesses /user/logout, sign them out and redirect back to the home page
    req.logout();
    res.redirect('/');
});

module.exports = router; //Allows the router object to be accessed through require()
