const express = require('express');
const { check, validationResult } = require('express-validator');
const db = require('../db.js');
const router = express.Router();

const allSubjects = require('../static/json/classes.json');
const subjects = [];
for (const heading in allSubjects) subjects.push(...allSubjects[heading]);

//Middleware to make sure any user trying to access the user pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isStudent) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', async (req, res) => { //When a user accesses /user, display a custom page with ejs
    const sessions = await db.getSessions('student', req.user.googleId);
    const onStudentPage = true;
    res.render('student/index.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions,
        onStudentPage
    });
});
router.post('/rate/:id', async (req, res) => {
    const possibleRatings = ['1', '2', '3', '4', '5'];
    if (possibleRatings.includes(req.body.mentorRating) && possibleRatings.includes(req.body.sessionRating)) {
        const mentorRating = parseInt(req.body.mentorRating);
        const sessionRating = parseInt(req.body.sessionRating);

        const error = await db.rateSession(req.user.googleId, 'student', req.params.id, {
            studentToMentor: mentorRating,
            studentToSession: sessionRating
        });
        if (error == -1) res.redirect('/student');
        else res.send(error);
    } else {
        res.send('Please enter a valid rating. Either "1", "2", "3", "4", or "5"');
    }
});

router.get('/requests', (req, res) => {
    res.render('student/request.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        values: {},
        errors: [],
        subjects
    });
});
router.post('/requests', [
    check('subject').trim().notEmpty().escape(),
    check('datetimeMS').trim().notEmpty().isNumeric(),
    check('length').trim().notEmpty().isNumeric()
], async (req, res) => {
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
            errors,
            subjects
        });
        return;
    }
    const mentors = await db.getMentors(dateMS, req.body.subject, req.user.googleId);
    const peerLeaders = await db.getPeerLeaders(dateMS);
    if (mentors.length == 0 || peerLeaders.length == 0) { //If no mentors/peerLeaders are available, ask them to
        // choose a different date/time
        res.render('student/request.ejs', {
            signedIn: (req.user != null),
            ...req.user,
            values: req.body,
            errors: ['noneFound'],
            subjects
        });
        return;
    }

    // const sessions = db.getSessions("student", req.user.id);
    // console.log(sessions);
    // for(const session of sessions){
    //     console.log(session.dateTime , dateMS);
    //     if(session.dateTime === dateMS){
    //         console.log("SAME DATE TIME");
    //     }
    // }


    await db.addSession({
        student: {
            id: req.user.googleId,
            name: req.user.firstName + ' ' + req.user.lastName,
            grade: req.user.grade,
            email: req.user.email
        },
        mentors,
        mentorConfirm: false,
        peerLeaders,
        peerLeaderConfirm: false,
        dateTime: dateMS,
        subject: req.body.subject,
        length: parseInt(req.body.length),
        cancelled: false,
        done: false,
        ratings: {}
    });

    //Update DB with information
    res.redirect('/student');
});

router.post('/cancel/:id', async (req, res) => {
    const error = await db.cancelSession(req.params.id, req.user.googleId);
    if (error == -1) res.redirect('/student');
    else res.send(error);
});

module.exports = router; //Allows the router object to be accessed through require()
