const express = require('express');
const db = require('../db.js');
const router = express.Router();

//Middleware to make sure any user trying to access the user pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isMentor) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', async (req, res) => { //When a user accesses /user, display a custom page with ejs
    const sessions = await db.getSessions('mentor', req.user.googleId);
    res.render('mentor/index.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions
    });
});

router.post('/accept/:id', async (req, res) => {
    const error = await db.acceptSession(req.params.id, 'mentor', req.user.googleId);
    if (error == -1) {
        res.redirect('/mentor');
    } else {
        res.send(error);
    }
});
//TODO Make it so that if you get sent to the homepage for not being logged in, it shows a message
router.post('/reject/:id', async (req, res) => {
    const error = await db.rejectSession(req.params.id, 'mentor', req.user.googleId);
    if (error == -1) {
        res.redirect('/mentor');
    } else {
        res.send(error);
    }
});

module.exports = router; //Allows the router object to be accessed through require()

