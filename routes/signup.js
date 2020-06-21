const express = require('express');
const { check, validationResult } = require('express-validator');
const db = require('../db.js');
const router = express.Router();

router.get('/', (req, res) => { //When someone accesses /signup
    if (!req.user) { //If they aren't signed in with google yet
        res.redirect('/');
    } else {
        res.render('signup/index.ejs', {
            signedIn: true,
            firstName: req.user.firstName,
            isStudent: req.user.isStudent,
            isMentor: req.user.isMentor,
            appliedMentor: req.user.appliedMentor
        });
    }
});

router.get('/student', (req, res) => { //When someone accesses /signup/student
    if (!req.user || req.user.isStudent) {//If they aren't signed in or are already a student
        res.redirect('/'); 
    } else {
        res.render('signup/student.ejs', {
            signedIn: true,
            firstName: req.user.firstName,
            isStudent: req.user.isStudent,
            isMentor: req.user.isMentor,
            appliedMentor: req.user.appliedMentor,
            values: {
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email
            },
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
        res.render('signup/mentor.ejs', {
            signedIn: true,
            isStudent: req.user.isStudent,
            isMentor: req.user.isMentor,
            appliedMentor: req.user.appliedMentor,
            firstName: req.user.firstName,
            values: {
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            },
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
    if (!req.user || req.user.appliedMentor) {
        res.status(401);
    } else {
        const subjects = 
            ['K-5 Science', '6-8 Science', 'Earth + Environmental Science', 'Biology', 'Chemistry', 'Physics',
                'K-5 Math', '6-8 Math', 'Math 1', 'Math 2', 'Math 3', 'Pre-Calculus', 'Calculus', 'Statistics',
                'K-5 Social Studies', '6-8 Social Studies', 'World History', 'American History', 'K-5 English', '6-8 English', '9-12 English',
                'Computer Science', 'Economics', 'Chinese', 'Spanish', 'French', 'German', 'Latin', 'Music', 'Music theory'];
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
            availability: chosenTimes
        });
        res.redirect('/signup/applied');
    }
});

router.get('/applied', (req, res) => {
    if (!req.user || !req.user.appliedMentor || req.user.isMentor) {
        req.redirect('/');
    } else {
        let data = {
            signedIn: (req.user != null)
        }
        if (req.user) {
            data.isStudent = req.user.isStudent;
            data.isMentor = req.user.isMentor;
            data.appliedMentor = req.user.appliedMentor;
            data.firstName = req.user.firstName;
        }
        res.render('signup/applied.ejs', data);
    }
});

module.exports = router;
