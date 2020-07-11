const express = require('express');
const db = require('../db.js');
const router = express.Router();

//Middleware to make sure any peerLeader trying to access the peerLeader pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isPeerLeader) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', async (req, res) => { //When a user accesses /peerleader, display a custom page with ejs
    const sessions = await db.getPeerLeaderSessions(req.user.googleId);
    res.render('peerLeader/index.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions
    });
});

module.exports = router; //Allows the router object to be accessed through require()

