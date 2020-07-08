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
router.post('/requests', [ //TODO Prevent student from spamming submit request button and creating duplicate requests
    check('subject').trim().notEmpty().escape(),
    check('datetimeMS').trim().notEmpty().isNumeric()
], async (req, res) => {
    if (!req.user || !req.user.isStudent) {
        res.status(401);
    } else {

        const errors = validationResult(req);
        const dateMS = parseInt(req.body.datetimeMS);
        const currentTime = new Date().getTime();

        if (!errors.isEmpty() || dateMS <= currentTime) {
            let allErrors = errors.array().map(e => e.param);
            if (dateMS <= currentTime) allErrors.push('tooEarly');
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
            student: {
                id: req.user.googleId,
                name: req.user.firstName + ' ' + req.user.lastName,
                grade: req.user.grade
            },
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

router.post('/cancel/:id', async (req, res) => {
    if (!req.user || !req.user.isStudent) { //TODO I think this is redundant...
        res.status(401);
    } else {
        console.log('Session cancel request for sess ' + req.params.id);
        const errorCode = await db.cancelSession(req.params.id, req.user.googleId);
        if (errorCode == -1) {
            res.redirect('/student');
        } else {
            res.status(errorCode);
        }
    }
});

module.exports = router; //Allows the router object to be accessed through require()
