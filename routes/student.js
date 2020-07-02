const express = require('express');
const { check, validationResult } = require('express-validator');
const db = require('../db.js');
const router = express.Router();

//Middleware to make sure any user trying to access the user pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isStudent) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', async (req, res) => { //When a user accesses /user, display a custom page with ejs
    const sessions = await db.getUserSessions(req.user.googleId);
    console.log('Got sessions: ', sessions);
    res.render('student/index.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions
    });
});

router.get('/requests', (req, res) => {
    res.render('student/request.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        values: {},
        errors: []
    });
});
router.post('/requests', [
    check('subject').trim().notEmpty().escape()
//    check('datetime').escape()
], async (req, res) => {
    if (!req.user || !req.user.isStudent) {
        res.status(401);
    } else {
        const errors = validationResult(req);
        const regex = /\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{1,2} [AP]M/;
        const date = new Date(req.body.datetime); //TODO Make sure this is in EST
        const dateMS = date.getTime();
        const goodDate = (regex.test(req.body.datetime) && date != 'Invalid Date');

        if (!errors.isEmpty() || !goodDate) {
            let allErrors = errors.array().map(e => e.param);
            if (!goodDate) allErrors.push('datetime');
            res.render('student/request.ejs', {
                signedIn: (req.user != null),
                ...req.user,
                values: req.body,
                errors: allErrors
            });
            return;
        }

        //TODO Error checking to make sure req.body.subject is a real subject
        const mentors = await db.getMentors(dateMS, req.body.subject, req.user.googleId);
        const peerLeaders = await db.getPeerLeaders(dateMS);
        console.log('Found mentors', mentors);
        console.log('Found peer leaders', peerLeaders);
        await db.addSession({
            studentId: req.user.googleId,
            mentors,
            mentorConfirm: false,
            peerLeaders,
            peerLeaderConfirm: false,
            dateTime: dateMS,
            subject: req.body.subject,
            cancelled: false,
            done: false
        });
        //Update DB with information
        res.redirect('/student');
    }
});

module.exports = router; //Allows the router object to be accessed through require()
