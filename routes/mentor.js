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
router.post('/rate/:id', async (req, res) => {
    const possibleRatings = ['1', '2', '3', '4', '5'];
    if (possibleRatings.includes(req.body.sessionRating)) {
        const sessionRating = parseInt(req.body.sessionRating);
        const error = await db.rateSession(req.user.googleId, 'mentor', req.params.id, {
            mentorToSession: sessionRating
        });
        if (error == -1) res.redirect('/mentor');
        else res.send(error);
    } else {
        res.send('Please enter a valid rating. Either "1", "2", "3", "4", or "5"');
    }
});


router.post('/accept/:id', async (req, res) => {
    const error = await db.acceptSession(req.params.id, 'mentor', req.user.googleId);
    if (error == -1) {
        res.redirect('/mentor');
    } else {
        res.send(error);
    }
});

router.post('/reject/:id', async (req, res) => {
    const error = await db.rejectSession(req.params.id, 'mentor', req.user.googleId);
    if (error == -1) {
        res.redirect('/mentor');
    } else {
        res.send(error);
    }
});

module.exports = router; //Allows the router object to be accessed through require()

