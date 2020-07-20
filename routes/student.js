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
    const sessions = await db.getSessions('student', req.user.googleId);
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
    check('subject').trim().notEmpty().escape(),
    check('datetimeMS').trim().notEmpty().isNumeric(),
    check('length').trim().notEmpty().isNumeric()
], async (req, res) => {
    if (!req.user || !req.user.isStudent) {
        res.status(401);
    } else {
        const dateMS = parseInt(req.body.datetimeMS);
        const currentTime = new Date().getTime();

        const errors = validationResult(req).array().map(e => e.param);
        if (dateMS <= currentTime) errors.push('tooEarly');
        if (!['30', '45', '60'].includes(req.body.length)) errors.push('length');

        if (errors.length > 0) {
            res.render('student/request.ejs', {
                signedIn: (req.user != null),
                ...req.user,
                values: req.body,
                errors
            });
            return;
        }
        
        const mentors = await db.getMentors(dateMS, req.body.subject, req.user.googleId);
        const peerLeaders = await db.getPeerLeaders(dateMS);
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
            length: parseInt(req.body.length),
            cancelled: false,
            done: false
        });
        //Update DB with information
        res.redirect('/student');
    }
});

router.post('/cancel/:id', async (req, res) => {
    const error = await db.cancelSession(req.params.id, req.user.googleId);
    if (error == -1) res.redirect('/student');
    else res.send(error);

});

module.exports = router; //Allows the router object to be accessed through require()
