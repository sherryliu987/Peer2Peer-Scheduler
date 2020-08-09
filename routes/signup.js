const express = require('express');
const { check, validationResult } = require('express-validator');
const db = require('../db.js');
const allSubjects = require('../static/json/classes.json');
const router = express.Router();

router.get('/', (req, res) => { //When someone accesses /signup
    if (!req.user) { //If they aren't signed in with google yet
        res.redirect('/');
    } else {
        res.render('signup/index.ejs', {
            signedIn: (req.user != null),
            ...req.user
        });
    }
});

router.get('/student', (req, res) => { //When someone accesses /signup/student
    if (!req.user || req.user.isStudent) {//If they aren't signed in or are already a student
        res.redirect('/');
    } else {
        res.render('signup/student.ejs', {
            signedIn: (req.user != null),
            ...req.user,
            values: { ...req.user },
            errors: []
        });
    }
});

router.post('/student', [
    check('firstName').trim().notEmpty().escape(),
    check('lastName').trim().notEmpty().escape(),
    check('email').isEmail().normalizeEmail().escape(),
    check('school').trim().notEmpty().escape(),
    check('phone').isMobilePhone().escape(),
    check('state').isLength(2).escape()
], async (req, res) => {
    if (!req.user || req.user.isStudent) {
        res.status(401);
    } else {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.render('signup/student.ejs', {
                signedIn: (req.user != null),
                ...req.user,
                values: req.body,
                errors: errors.array().map(e => e.param)
            });
            return;
        }
        await db.updateUser(req.user.googleId, {
            isStudent: true,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            grade: req.body.grade,
            state: req.body.state,
            school: req.body.school,
            phone: req.body.phone
        });
        res.redirect('/student');
    }
});

router.get('/mentor', (req, res) => { //When someone accesses /signup/mentor
    if (!req.user || req.user.appliedMentor) {//If they aren't signed in or are already a mentor
        res.redirect('/');
    } else {
        let values = { ...req.user };
        if (req.user.isPeerLeader || req.user.appliedPeerLeader)
            for (const avail of req.user.availability) values[avail] = true;
        res.render('signup/mentor.ejs', {
            signedIn: (req.user != null),
            ...req.user,
            allSubjects,
            values,
            errors: []
        });
    }
});

router.post('/mentor', [
    check('firstName').trim().notEmpty().escape(),
    check('lastName').trim().notEmpty().escape(),
    check('email').isEmail().normalizeEmail().escape(),
    check('school').trim().notEmpty().escape(),
    check('phone').isMobilePhone().escape(),
    check('state').isLength(2).escape()
], async (req, res) => {
    if (!req.user || req.user.isMentor ||  req.user.appliedMentor) {
        res.send('You have already applied or already a mentor.');
    } else {
        const subjects = [];
        for (const heading in allSubjects) subjects.push(...allSubjects[heading]);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const times = ['Morning', 'Afternoon', 'Evening'];
        let chosenSubjects = [];
        let chosenTimes = [];
        for (const subject of subjects) {
            if (req.body[subject] == 'on') chosenSubjects.push(subject);
        }
        for (const day of days) {
            for (const time of times) {
                if (req.body[day + ' ' + time] == 'on') chosenTimes.push(day + ' ' + time);
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty() || chosenSubjects.length == 0 || chosenTimes.length == 0) {
            const errorsArr = errors.array().map(e => e.param);
            if (chosenSubjects.length == 0) errorsArr.push('subjects');
            if (chosenTimes.length == 0) errorsArr.push('times');

            res.render('signup/mentor.ejs', {
                signedIn: (req.user != null),
                ...req.user,
                allSubjects,
                values: req.body,
                errors: errorsArr
            });
            return;
        }
        await db.updateUser(req.user.googleId, {
            appliedMentor: true,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            grade: req.body.grade,
            state: req.body.state,
            school: req.body.school,
            phone: req.body.phone,
            subjects: chosenSubjects,
            availability: chosenTimes,
            rating: 4, //Default rating of 4
            lastSession: Date.now() //Default last session of when they registered
        });
        res.redirect('/signup/applied/mentor');
    }
});


router.get('/peerleader', (req, res) => { //When someone accesses /signup/peerleader
    if (!req.user || req.user.isPeerLeader || req.user.appliedPeerLeader) {//If they aren't signed in or are already a peerleader
        res.redirect('/');
    } else {
        let values = { ...req.user };
        if (req.user.isMentor || req.user.appliedMentor) {
            for (const avail of req.user.availability) values[avail] = true;
            for (const subject of req.user.subjects) values[subject] = true;
        }
        res.render('signup/peerLeader.ejs', {
            signedIn: (req.user != null),
            ...req.user,
            values,
            errors: []
        });
    }
});

router.post('/peerleader', [
    check('firstName').trim().notEmpty().escape(),
    check('lastName').trim().notEmpty().escape(),
    check('email').isEmail().normalizeEmail().escape(),
    check('school').trim().notEmpty().escape(),
    check('phone').isMobilePhone().escape(),
    check('state').isLength(2).escape()
], async (req, res) => {
    if (!req.user || req.user.isPeerLeader || req.user.appliedPeerLeader) {
        res.send('You have already applied or already a peer leader.');
    } else {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const times = ['Morning', 'Afternoon', 'Evening'];
        let chosenTimes = [];
        for (const day of days) {
            for (const time of times) {
                if (req.body[day + ' ' + time] == 'on') chosenTimes.push(day + ' ' + time);
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty() || chosenTimes.length == 0) {
            const errorsArr = errors.array().map(e => e.param);
            if (chosenTimes.length == 0) errorsArr.push('times');
            res.render('signup/peerLeader.ejs', {
                signedIn: (req.user != null),
                ...req.user,
                values: req.body,
                errors: errorsArr
            });
            return;
        }
        await db.updateUser(req.user.googleId, {
            appliedPeerLeader: true,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            grade: req.body.grade,
            state: req.body.state,
            school: req.body.school,
            phone: req.body.phone,
            availability: chosenTimes,
            lastSession: Date.now(), //Default last session of when they registered
            zoomLink: '',
            zoomPass: ''
        });
        res.redirect('/signup/applied/peerLeader');
    }
});

router.get('/applied/:type', (req, res) => {
    res.render('signup/applied.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        type: req.params.type
    });
});

module.exports = router;
